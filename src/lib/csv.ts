import type { EscalaEvent, NameColorMap } from "#/types";

function detectDelimiter(text: string): string {
	const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
	const delimiters = [",", ";", "\t"];

	return (
		delimiters
			.map((delimiter) => ({
				delimiter,
				count: firstLine.split(delimiter).length,
			}))
			.sort((a, b) => b.count - a.count)[0]?.delimiter ?? ","
	);
}

function normalizeText(value: string): string {
	return value
		.replace(/^\uFEFF/, "")
		.trim()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase();
}

function isCabeamento(title: string): boolean {
	return normalizeText(title).includes("cabeamento");
}

function isAvailable(value: string): boolean {
	const normalized = normalizeText(value);
	return normalized === "disponivel" || /^dispon.*vel$/.test(normalized);
}

function parseCSVRaw(text: string): string[][] {
	const delimiter = detectDelimiter(text);
	const rows: string[][] = [];
	let i = 0;
	while (i < text.length) {
		const row: string[] = [];
		while (i < text.length && text[i] !== "\n" && text[i] !== "\r") {
			if (text[i] === '"') {
				let field = "";
				i++;
				while (i < text.length) {
					if (text[i] === '"' && text[i + 1] === '"') {
						field += '"';
						i += 2;
					} else if (text[i] === '"') {
						i++;
						break;
					} else {
						field += text[i];
						i++;
					}
				}
				row.push(field);
				if (text[i] === delimiter) i++;
			} else {
				let field = "";
				while (
					i < text.length &&
					text[i] !== delimiter &&
					text[i] !== "\n" &&
					text[i] !== "\r"
				) {
					field += text[i];
					i++;
				}
				row.push(field);
				if (text[i] === delimiter) i++;
			}
		}
		if (text[i] === "\r") i++;
		if (text[i] === "\n") i++;
		if (row.length > 0 && row.some((c) => c.trim())) rows.push(row);
	}
	return rows;
}

function extractYear(value: string): number | null {
	const match = value.match(/\b(20\d{2})\b/);
	return match ? parseInt(match[1], 10) : null;
}

function extractDate(
	col: string,
	fallbackYear: number,
): { day: number; month: number; year: number } | null {
	const m = col.match(/\[(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\]/);
	if (!m) return null;
	const day = parseInt(m[1], 10);
	const monthNumber = parseInt(m[2], 10);
	const year = m[3] ? parseInt(m[3], 10) : fallbackYear;

	if (monthNumber < 1 || monthNumber > 12 || day < 1) return null;
	const date = new Date(year, monthNumber - 1, day);
	if (
		date.getFullYear() !== year ||
		date.getMonth() !== monthNumber - 1 ||
		date.getDate() !== day
	) {
		return null;
	}

	const month = monthNumber - 1;
	return { day, month, year };
}

function extractTime(col: string): string | null {
	const patterns = [
		/Chegada[^\d]*(\d{1,2}:\d{2})hs/i,
		/Chegada[^\d]*(\d{1,2})hs/i,
		/(\d{1,2}:\d{2})hs/i,
		/(\d{1,2})hs/i,
	];
	for (const p of patterns) {
		const m = col.match(p);
		if (m) return m[1].includes(":") ? m[1] : `${m[1]}:00`;
	}
	return null;
}

function extractTitle(col: string): string {
	let title = col.split("\n")[0].trim();
	title = title.replace(/\s*\[.*?\]\s*/g, "").trim();
	title = title
		.replace(/Escala para as quartas-feiras\.\s*/i, "Quarta-feira")
		.replace(/Escala para as quintas-feiras\.\s*/i, "Quinta-feira")
		.replace(/Escala para as sextas-feiras\.\s*/i, "Sexta-feira")
		.replace(/Escala para os Domingos \(Manh[aã]\)\.\s*/i, "Domingo — Manhã")
		.replace(/Escala para os Domingos \(Noite\)\.\s*/i, "Domingo — Noite")
		.replace(/Operador\(a\) de C[aâ]meras:.*$/i, "")
		.replace(/Corpus Christi\s*/i, "Corpus Christi")
		.replace(/Dia "D Mission[aá]rio".*$/i, "Dia D Missionário")
		.replace(/^CPP\s*/i, "CPP")
		.replace(/Cobertura fotogr[aá]fica dos Tr[ií]duos.*$/i, "Tríduos")
		.trim();
	return title || "Evento";
}

export interface ProcessedData {
	events: EscalaEvent[];
	nameColors: NameColorMap;
}

export function processCSV(csvText: string): ProcessedData | null {
	const rows = parseCSVRaw(csvText);
	if (rows.length < 2) return null;

	const headers = rows[0];
	const nameColIdx = headers.findIndex((h) => normalizeText(h) === "nome");
	if (nameColIdx < 0) return null;
	const fallbackYear =
		rows
			.slice(1)
			.map((row) => extractYear(row[0] ?? ""))
			.find(Boolean) ?? new Date().getFullYear();

	const nameColors: NameColorMap = {};
	let colorIdx = 0;
	for (let r = 1; r < rows.length; r++) {
		const name = (rows[r][nameColIdx] || "").trim();
		if (name && !(name in nameColors)) {
			nameColors[name] = colorIdx % 10;
			colorIdx++;
		}
	}

	const events: EscalaEvent[] = [];

	for (let c = 0; c < headers.length; c++) {
		if (c === nameColIdx) continue;
		const col = headers[c];
		const dateInfo = extractDate(col, fallbackYear);
		if (!dateInfo) continue;

		const names: string[] = [];
		for (let r = 1; r < rows.length; r++) {
			const val = (rows[r][c] || "").trim();
			if (isAvailable(val)) {
				const name = (rows[r][nameColIdx] || "").trim();
				if (name) names.push(name);
			}
		}
		if (names.length === 0) continue;

		const title = extractTitle(col);
		events.push({
			...dateInfo,
			title,
			time: extractTime(col),
			names,
			colHeader: col,
			isCabeamento: isCabeamento(title),
		});
	}

	events.sort((a, b) => {
		const da = new Date(a.year, a.month, a.day).getTime();
		const db = new Date(b.year, b.month, b.day).getTime();
		return da - db || (a.time ?? "00:00").localeCompare(b.time ?? "00:00");
	});

	return { events, nameColors };
}
