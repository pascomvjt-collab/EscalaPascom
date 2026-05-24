import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { processCSV } from "#/lib/csv";
import type { EscalaEvent, NameColorMap } from "#/types";
import { UploadZone } from "#/components/upload-zone";
import { Calendar } from "#/components/calendar";
import { Schedule } from "#/components/schedule";
import {
	type AssignmentMap,
	type EventMetaMap,
	type EventShift,
	type ManualFunctions,
	getBuilderEvent,
	getLiturgicalTimeOption,
	getShiftOption,
	inferShiftFromTime,
	ScheduleBuilder,
} from "#/components/schedule-builder";
import { Check } from "lucide-react";

export const Route = createFileRoute("/")({ component: EscalaApp });

const PT_MONTHS = [
	"Janeiro",
	"Fevereiro",
	"Março",
	"Abril",
	"Maio",
	"Junho",
	"Julho",
	"Agosto",
	"Setembro",
	"Outubro",
	"Novembro",
	"Dezembro",
];
const PT_DAYS_FULL = [
	"Domingo",
	"Segunda-feira",
	"Terça-feira",
	"Quarta-feira",
	"Quinta-feira",
	"Sexta-feira",
	"Sábado",
];
const PT_DAYS_SECTION = [
	"Domingos",
	"Segundas-feiras",
	"Terças-feiras",
	"Quartas-feiras",
	"Quintas-feiras",
	"Sextas-feiras",
	"Sábados",
];
const SHIFT_ORDER: Record<EventShift, number> = {
	manha: 0,
	tarde: 1,
	noite: 2,
};

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

function getOrdinalWeekdayLabel(year: number, month: number, day: number) {
	const date = new Date(year, month, day);
	const weekday = date.getDay();
	let count = 0;

	for (let currentDay = 1; currentDay <= day; currentDay++) {
		if (new Date(year, month, currentDay).getDay() === weekday) {
			count++;
		}
	}

	return `${count}º ${PT_DAYS_FULL[weekday].toUpperCase()} (${String(day).padStart(2, "0")}/${String(month + 1).padStart(2, "0")})`;
}

function normalizeGroupKey(value: string): string {
	return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function EscalaApp() {
	const [events, setEvents] = useState<EscalaEvent[]>([]);
	const [nameColors, setNameColors] = useState<NameColorMap>({});
	const [fileName, setFileName] = useState<string | null>(null);
	const [year, setYear] = useState(new Date().getFullYear());
	const [month, setMonth] = useState(new Date().getMonth());
	const [selectedDay, setSelectedDay] = useState<number | null>(null);
	const [viewMode, setViewMode] = useState<"availability" | "builder">(
		"availability",
	);
	const [assignments, setAssignments] = useState<AssignmentMap>({});
	const [functionsByEvent, setFunctionsByEvent] = useState<ManualFunctions>({});
	const [eventMeta, setEventMeta] = useState<EventMetaMap>({});
	const [copiedName, setCopiedName] = useState<string | null>(null);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const [, setPdfLoading] = useState(false);
	const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

	const hasData = events.length > 0;

	function handleFile(file: File) {
		const reader = new FileReader();
		setUploadError(null);

		reader.onload = (e) => {
			try {
				const csvText = e.target?.result;
				if (typeof csvText !== "string") {
					setUploadError("Não foi possível ler o conteúdo do arquivo CSV.");
					return;
				}

				const result = processCSV(csvText);
				if (!result) {
					setUploadError(
						'CSV inválido: não encontrei a coluna "Nome" ou dados suficientes.',
					);
					return;
				}

				if (result.events.length === 0) {
					setUploadError(
						'CSV lido, mas nenhuma escala com "Disponível" e data reconhecida foi encontrada.',
					);
					return;
				}

				setEvents(result.events);
				setNameColors(result.nameColors);
				setAssignments({});
				setFunctionsByEvent({});
				setEventMeta({});
				setViewMode("builder");
				setFileName(file.name);
				setSelectedDay(null);
				setYear(result.events[0].year);
				setMonth(result.events[0].month);
			} catch {
				setUploadError(
					"Erro ao processar o CSV. Verifique o formato do arquivo e tente novamente.",
				);
			}
		};

		reader.onerror = () => {
			setUploadError(
				"Erro ao ler o arquivo CSV. Tente exportar a planilha novamente.",
			);
		};

		try {
			reader.readAsText(file, "UTF-8");
		} catch {
			setUploadError("Erro ao abrir o arquivo CSV selecionado.");
		}
	}

	function handleCopy(name: string) {
		const write = () => {
			setCopiedName(name);
			clearTimeout(toastTimer.current);
			toastTimer.current = setTimeout(() => setCopiedName(null), 2200);
		};
		navigator.clipboard
			.writeText(name)
			.then(write)
			.catch(() => {
				const ta = document.createElement("textarea");
				ta.value = name;
				ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
				document.body.appendChild(ta);
				ta.select();
				document.execCommand("copy");
				document.body.removeChild(ta);
				write();
			});
	}

	function navMonth(delta: number) {
		let m = month + delta;
		let y = year;
		if (m > 11) {
			m = 0;
			y++;
		}
		if (m < 0) {
			m = 11;
			y--;
		}
		setMonth(m);
		setYear(y);
		setSelectedDay(null);
	}

	function handleSelectDay(day: number) {
		if (selectedDay === day) {
			setSelectedDay(null);
			return;
		}

		setSelectedDay(day);
		setTimeout(() => {
			document
				.getElementById("schedule-section")
				?.scrollIntoView({ behavior: "smooth", block: "start" });
		}, 50);
	}

	function handleAssign(key: string, volunteers: string[]) {
		setAssignments((current) => {
			const next = { ...current };
			if (volunteers.length > 0) {
				next[key] = volunteers;
			} else {
				delete next[key];
			}
			return next;
		});
	}

	function handleGenerateAvailabilityPDF() {
		setPdfLoading(true);

		const monthName = `${PT_MONTHS[month]} ${year}`;
		const eventsToRender = selectedDay
			? events.filter(
					(e) => e.day === selectedDay && e.month === month && e.year === year,
				)
			: events.filter((e) => e.month === month && e.year === year);

		const byDay: Record<number, EscalaEvent[]> = {};
		for (const ev of eventsToRender) {
			if (!byDay[ev.day]) byDay[ev.day] = [];
			byDay[ev.day].push(ev);
		}

		const colorMap: Record<number, string> = {
			0: "#5ba0a4",
			1: "#c49a45",
			2: "#c46870",
			3: "#9171b8",
			4: "#5f9b74",
			5: "#5b87c4",
			6: "#c47a5b",
			7: "#a07090",
			8: "#5aa890",
			9: "#a09060",
		};

		let cardsHtml = "";
		const sortedDays = Object.keys(byDay)
			.map(Number)
			.sort((a, b) => a - b);

		for (const day of sortedDays) {
			const dow = PT_DAYS_FULL[new Date(year, month, day).getDay()];
			cardsHtml += `<div class="day-title">${String(day).padStart(2, "0")} de ${PT_MONTHS[month]} — ${dow}</div>`;

			for (const ev of byDay[day]) {
				const namesHtml = ev.names
					.map((n) => {
						const col = colorMap[nameColors[n] ?? 0];
						return `<span style="display:inline-flex;align-items:center;padding:3px 9px;border-radius:4px;font-size:11px;font-weight:600;color:${col};background:${col}1c;border:1px solid ${col}38;margin:2px 3px 2px 0;">${n}</span>`;
					})
					.join("");

				cardsHtml += `
          <div class="card">
            <div class="card-meta">${String(ev.day).padStart(2, "0")} ${PT_MONTHS[month].slice(0, 3)} ${ev.year}${ev.time ? ` · ${ev.time}` : ""}</div>
            <div class="card-title">${ev.title}</div>
            <div class="names">${namesHtml}</div>
          </div>`;
			}
		}

		const printDate = new Date().toLocaleDateString("pt-BR");

		const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Escala PASCOM — ${selectedDay ? `${String(selectedDay).padStart(2, "0")} de ${PT_MONTHS[month]} de ${year}` : monthName}</title>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Manrope:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Manrope', sans-serif; color: #1a1b26; background: #e8e4d9; min-height: 100vh; padding: 40px 16px; }
  .page { max-width: 800px; margin: 0 auto; background: #fff; padding: 32px 40px; border-radius: 4px; box-shadow: 0 2px 16px rgba(0,0,0,0.10); }
  .header { border-bottom: 2px solid #c49a45; padding-bottom: 20px; margin-bottom: 30px; }
  .header-title { font-family: 'Fraunces', serif; font-size: 22px; color: #1a1b26; font-weight: 700; margin-bottom: 3px; }
  .header-sub { font-size: 11px; color: #797b8e; letter-spacing: 0.15em; text-transform: uppercase; }
  .header-period { font-family: 'Fraunces', serif; font-size: 13px; color: #c49a45; margin-top: 8px; font-weight: 500; }
  .day-title { font-family: 'Fraunces', serif; font-size: 12px; color: #c49a45; letter-spacing: 0.08em; text-transform: uppercase; margin: 22px 0 10px; padding-bottom: 6px; border-bottom: 1px solid #e8e4d9; }
  .card { background: #fafaf8; border: 1px solid #e8e4d9; border-radius: 8px; padding: 13px 15px; margin-bottom: 9px; break-inside: avoid; }
  .card-meta { font-size: 10px; font-weight: 700; color: #797b8e; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 3px; }
  .card-title { font-size: 13px; font-weight: 700; color: #1a1b26; margin-bottom: 8px; line-height: 1.3; }
  .names { display: flex; flex-wrap: wrap; }
  .footer { margin-top: 36px; padding-top: 14px; border-top: 1px solid #e8e4d9; font-size: 10px; color: #797b8e; text-align: center; letter-spacing: 0.06em; }
  @media print {
    body { background: #fff; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { max-width: none; margin: 0; box-shadow: none; border-radius: 0; }
    .card { break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-title">Escala da PASCOM</div>
      <div class="header-sub">Pastoral da Comunicação</div>
      <div class="header-period">${selectedDay ? `${String(selectedDay).padStart(2, "0")} de ${PT_MONTHS[month]} de ${year}` : monthName}</div>
    </div>
    ${cardsHtml}
    <div class="footer">Gerado em ${printDate}</div>
  </div>
</body>
</html>`;

		const blob = new Blob([html], { type: "text/html" });
		const url = URL.createObjectURL(blob);
		const win = window.open(url, "_blank");
		if (win) {
			win.onload = () => {
				setTimeout(() => {
					win.print();
					URL.revokeObjectURL(url);
				}, 700);
			};
		}

		setTimeout(() => setPdfLoading(false), 1500);
	}

	function handleGenerateBuilderPDF() {
		setPdfLoading(true);

		const builderEvents = events
			.filter(
				(event) =>
					event.year === year &&
					event.month === month &&
					(selectedDay ? event.day === selectedDay : true),
			)
			.map(getBuilderEvent)
			.sort((a, b) => {
				const byDay = a.day - b.day;
				const byTime = (a.time ?? "99:99").localeCompare(b.time ?? "99:99");
				return byDay || byTime || a.title.localeCompare(b.title, "pt-BR");
			});

		const period = selectedDay
			? `${String(selectedDay).padStart(2, "0")} de ${PT_MONTHS[month]}/${year}`
			: `${PT_MONTHS[month]}/${year}`;
		const title = `Escala comum de ${period}`;

		const renderEventContent = (event: ReturnType<typeof getBuilderEvent>) => {
				const meta = eventMeta[event.id];
				const liturgicalTime = getLiturgicalTimeOption(meta?.liturgicalTime);
				const eventTitle = meta?.title?.trim() || event.title;
				const eventTime = meta?.time ?? event.time ?? "";
				const functions = functionsByEvent[event.id] ?? [];
				const isCabeamento = meta?.isCabeamento ?? event.isCabeamento;
				const directorFunctions = functions.filter((fn) =>
					fn.label.trim().toLowerCase().startsWith("diretor"),
				);
				const regularFunctions = functions.filter(
					(fn) => !fn.label.trim().toLowerCase().startsWith("diretor"),
				);
				const cabeamentoKey = `${event.id}-cabeamento`;
				const cabeamentoNames = assignments[cabeamentoKey] ?? [];
				const functionRows = isCabeamento
					? `<div class="available-row">${cabeamentoNames.length > 0 ? escapeHtml(cabeamentoNames.join("; ")) : "&nbsp;"}</div>`
					: regularFunctions.length > 0
						? regularFunctions
								.map((fn) => {
									const volunteers = assignments[fn.id] ?? [];
									const volunteerText =
										volunteers.length > 0
											? escapeHtml(volunteers.join("; "))
											: "&nbsp;";

									return `
              <div class="function-row">
                <span class="function-name">${escapeHtml(fn.label)}</span>
                <span class="dash">-</span>
                <span class="agent-name">${volunteerText}</span>
              </div>`;
								})
								.join("")
						: `<div class="function-row empty-row"><span>&nbsp;</span></div>`;
				const directorNames = directorFunctions
					.flatMap((fn) => assignments[fn.id] ?? [])
					.filter(Boolean);
				const directorsHtml =
					!isCabeamento && directorFunctions.length > 0
						? `<footer class="directors-footer">
              <div class="directors-title">Diretores</div>
              <div class="directors-names">${directorNames.length > 0 ? escapeHtml(directorNames.join("; ")) : "&nbsp;"}</div>
            </footer>`
						: "";

				return `
          <section class="event-block" style="--accent:${liturgicalTime.color};--accent-soft:${liturgicalTime.color}26;--accent-band:${liturgicalTime.color}4d;">
            <div class="event-band">
            <div class="event-name">${escapeHtml(eventTitle)}${eventTime ? ` (${escapeHtml(eventTime)})` : ""}</div>
            </div>
            <div class="function-list">
            ${functionRows}
            </div>
            ${directorsHtml}
          </section>`;
			};

		const renderCard = (dayEvents: ReturnType<typeof getBuilderEvent>[]) => {
				const firstEvent = dayEvents[0];
				const firstMeta = eventMeta[firstEvent.id];
				const liturgicalTime = getLiturgicalTimeOption(
					firstMeta?.liturgicalTime,
				);
				const groupedEventBlocks = Object.values(
					dayEvents.reduce<
						Record<string, ReturnType<typeof getBuilderEvent>[]>
					>((grouped, event) => {
						const meta = eventMeta[event.id];
						const groupTitle = meta?.groupTitle?.trim() ?? "";
						const key = groupTitle
							? `group-${normalizeGroupKey(groupTitle)}`
							: `event-${event.id}`;
						if (!grouped[key]) grouped[key] = [];
						grouped[key].push(event);
						return grouped;
					}, {}),
				).sort((a, b) => {
					const firstA = a[0];
					const firstB = b[0];
					const timeA = eventMeta[firstA.id]?.time ?? firstA.time ?? "99:99";
					const timeB = eventMeta[firstB.id]?.time ?? firstB.time ?? "99:99";
					return timeA.localeCompare(timeB);
				});

				return `
        <article class="scale-card" style="--accent:${liturgicalTime.color};--accent-soft:${liturgicalTime.color}26;--accent-band:${liturgicalTime.color}4d;">
          <header class="card-header">${escapeHtml(getOrdinalWeekdayLabel(year, month, firstEvent.day))}</header>
          ${groupedEventBlocks
						.map((eventGroup) => eventGroup.map(renderEventContent).join(""))
						.join("")}
        </article>`;
			};

		const scheduleGroups = builderEvents.reduce<
			Record<
				string,
				{
					weekday: number;
					shift: EventShift;
					events: ReturnType<typeof getBuilderEvent>[];
				}
			>
		>((groups, event) => {
			const weekday = new Date(year, month, event.day).getDay();
			const meta = eventMeta[event.id];
			const shift = meta?.shift ?? inferShiftFromTime(meta?.time ?? event.time);
			const key = `${weekday}-${shift}`;
			if (!groups[key]) groups[key] = { weekday, shift, events: [] };
			groups[key].events.push(event);
			return groups;
		}, {});
		const maxScheduleColumns = Math.min(
			5,
			Math.max(
				1,
				...Object.values(scheduleGroups).map(
					(group) => new Set(group.events.map((event) => event.day)).size,
				),
			),
		);

		const cardsHtml = Object.values(scheduleGroups)
			.sort((a, b) => {
				const firstDayA = a.events[0]?.day ?? 0;
				const firstDayB = b.events[0]?.day ?? 0;
				return (
					firstDayA - firstDayB ||
					SHIFT_ORDER[a.shift] - SHIFT_ORDER[b.shift]
				);
			})
			.map((group) => {
				const groupEvents = group.events.sort((a, b) => {
					const byDay = a.day - b.day;
					const timeA = eventMeta[a.id]?.time ?? a.time ?? "99:99";
					const timeB = eventMeta[b.id]?.time ?? b.time ?? "99:99";
					const byTime = timeA.localeCompare(timeB);
					return byDay || byTime || a.title.localeCompare(b.title, "pt-BR");
				});
				const eventsByDay = groupEvents.reduce<
					Record<number, ReturnType<typeof getBuilderEvent>[]>
				>((grouped, event) => {
					if (!grouped[event.day]) grouped[event.day] = [];
					grouped[event.day].push(event);
					return grouped;
				}, {});
				const dayCards = Object.keys(eventsByDay)
					.map(Number)
					.sort((a, b) => a - b)
					.map((day) => renderCard(eventsByDay[day]));
				const usedDays = dayCards.length;
				const emptyCards = Array.from(
					{ length: Math.max(0, maxScheduleColumns - usedDays) },
					(_, index) => `<article class="scale-card placeholder" aria-hidden="true" data-placeholder="${index}"></article>`,
				).join("");
				const sectionTitle = `${PT_DAYS_SECTION[group.weekday]} - ${getShiftOption(group.shift).label}`;

				return `
        <section class="weekday-section" style="--cols:${maxScheduleColumns};">
          <h2 class="weekday-title">${escapeHtml(sectionTitle)}</h2>
          <div class="weekday-grid">${dayCards.join("")}${emptyCards}</div>
        </section>`;
			})
			.join("");

		const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style id="fit-page-size"></style>
<style>
  @page { size: A4 portrait; margin: 9mm 8mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #e8e5df;
    color: #050706;
    font-family: Manrope, Arial, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    min-height: 100vh;
    padding: 40px 16px;
  }
  .page {
    max-width: 794px;
    margin: 0 auto;
    background: #fff;
    padding: 20px 24px;
    border-radius: 4px;
    box-shadow: 0 2px 16px rgba(0,0,0,0.10);
  }
  .page-header {
    text-align: center;
    margin: 0 0 20px;
  }
  .parish {
    font-size: 10px;
    line-height: 1;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    margin-bottom: 20px;
  }
  .title {
    font-size: 29px;
    line-height: 1.1;
    font-weight: 400;
  }
  .weekday-section {
    margin-bottom: 20px;
  }
  .weekday-title {
    break-after: avoid;
    page-break-after: avoid;
    font-size: 11px;
    line-height: 1;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin: 0 0 7px;
  }
  .weekday-grid {
    display: grid;
    grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
    gap: 10px;
    align-items: stretch;
  }
  .scale-card {
    min-height: 132px;
    height: 100%;
    background: var(--accent-soft);
    display: block;
    overflow: hidden;
  }
  .scale-card.placeholder {
    background: transparent;
    border: 1px dashed rgba(0,0,0,0.08);
    visibility: hidden;
  }
  .card-header {
    background: var(--accent);
    min-height: 28px;
    padding: 7px 5px 6px;
    font-size: 10px;
    line-height: 1.1;
    font-weight: 800;
    text-align: center;
    color: #000000;
    text-transform: uppercase;
  }
  .event-band {
    background: var(--accent-band);
    text-align: center;
    font-size: 10px;
    line-height: 1.25;
  }
  .event-block + .event-block {
    border-top: 1px solid rgba(0,0,0,0.08);
  }
  .event-name {
    padding: 8px 5px;
    font-weight: 500;
  }
  .function-list {
    padding: 11px 7px 12px;
    font-size: 10px;
    line-height: 1.35;
  }
  .function-row {
    display: grid;
    grid-template-columns: minmax(56px, auto) 8px minmax(0, 1fr);
    gap: 3px;
    align-items: baseline;
    margin-bottom: 6px;
    min-height: 16px;
  }
  .function-name {
    white-space: nowrap;
  }
  .dash {
    text-align: center;
  }
  .agent-name {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .empty-row {
    display: block;
  }
  .available-row {
    overflow-wrap: anywhere;
  }
  .directors-footer {
    padding: 8px 7px 10px;
    text-align: center;
    font-size: 10px;
    line-height: 1.2;
  }
  .directors-title {
    font-weight: 700;
  }
  .directors-names {
    margin-top: 2px;
    overflow-wrap: anywhere;
  }
  @media print {
    body { background: #fff; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { max-width: none; margin: 0; padding: 0; box-shadow: none; border-radius: 0; }
    .weekday-title { break-after: avoid; page-break-after: avoid; }
    .event-block { break-inside: avoid; page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="page">
    <header class="page-header">
      <div class="parish">PARÓQUIA SENHORA SANT'ANA</div>
      <h1 class="title">${escapeHtml(title)}</h1>
    </header>
    <main>${cardsHtml}</main>
  </div>
  <script>
    (() => {
      const fitPage = () => {
        const page = document.querySelector('.page');
        const pxPerMm = 96 / 25.4;
        const contentHeight = Math.ceil((page ? page.scrollHeight : document.body.scrollHeight) / pxPerMm) + 18;
        const pageHeight = Math.min(297, Math.max(80, contentHeight));
        document.getElementById("fit-page-size").textContent =
          "@page { size: 210mm " + pageHeight + "mm; margin: 9mm 8mm; }";
      };

      if (document.fonts?.ready) {
        document.fonts.ready.then(fitPage);
      } else {
        window.addEventListener("load", fitPage);
      }
    })();
  </script>
</body>
</html>`;

		const blob = new Blob([html], { type: "text/html" });
		const url = URL.createObjectURL(blob);
		const win = window.open(url, "_blank");
		if (win) {
			win.onload = () => {
				setTimeout(() => {
					win.print();
					URL.revokeObjectURL(url);
				}, 700);
			};
		} else {
			URL.revokeObjectURL(url);
		}

		setTimeout(() => setPdfLoading(false), 1500);
	}

	return (
		<div style={{ maxWidth: 980, margin: "0 auto", padding: "0 20px 80px" }}>
			{/* ── Header ─────────────────────────────────────── */}
			<header
				style={{
					textAlign: "center",
					padding: "44px 20px 32px",
				}}
			>
				<h1
					style={{
						fontFamily: "Fraunces, Georgia, serif",
						fontSize: "clamp(1.6rem, 4vw, 2.4rem)",
						fontWeight: 700,
						color: "var(--ink)",
						letterSpacing: "-0.01em",
						lineHeight: 1.1,
						marginBottom: 8,
					}}
				>
					Escala da PASCOM
				</h1>
				<p
					style={{
						fontSize: 12,
						fontWeight: 600,
						color: "var(--ink-3)",
						letterSpacing: "0.18em",
						textTransform: "uppercase",
						marginBottom: 5,
					}}
				>
					Pastoral da Comunicação
				</p>
				<p
					style={{
						fontFamily: "Fraunces, Georgia, serif",
						fontSize: 13,
						fontWeight: 300,
						color: "var(--ink-2)",
						fontStyle: "italic",
					}}
				>
					Tudo para maior glória de Deus
				</p>

				{/* thin rule */}
				<div
					style={{
						width: 48,
						height: 1,
						background: "var(--gold)",
						margin: "20px auto 0",
						opacity: 0.5,
					}}
				/>
			</header>

			{/* ── Upload ─────────────────────────────────────── */}
			<UploadZone
				onFile={handleFile}
				onError={setUploadError}
				fileName={hasData ? fileName : null}
				error={uploadError}
			/>

			{/* ── Main content ───────────────────────────────── */}
			{hasData && (
				<>
					<div
						style={{
							display: "flex",
							justifyContent: "center",
							margin: "-6px 0 26px",
						}}
					>
						<div
							role="tablist"
							aria-label="Modo de trabalho"
							style={{
								display: "inline-flex",
								gap: 3,
								padding: 4,
								background: "var(--surface)",
								border: "1px solid var(--line)",
								borderRadius: 8,
							}}
						>
							<ModeButton
								active={viewMode === "availability"}
								onClick={() => setViewMode("availability")}
							>
								Disponibilidades
							</ModeButton>
							<ModeButton
								active={viewMode === "builder"}
								onClick={() => setViewMode("builder")}
							>
								Montar escala
							</ModeButton>
						</div>
					</div>

					{viewMode === "availability" ? (
						<div
							style={{
								display: "grid",
								gridTemplateColumns: "minmax(0,320px) 1fr",
								gap: 28,
								alignItems: "start",
							}}
							className="main-grid"
						>
							<div style={{ position: "sticky", top: 24 }}>
								<Calendar
									year={year}
									month={month}
									events={events}
									selectedDay={selectedDay}
									onSelectDay={handleSelectDay}
									onNavMonth={navMonth}
								/>
							</div>

							<div id="schedule-section">
								<Schedule
									events={events}
									nameColors={nameColors}
									year={year}
									month={month}
									selectedDay={selectedDay}
									onClearDay={() => setSelectedDay(null)}
									onCopyName={handleCopy}
									onGeneratePDF={handleGenerateAvailabilityPDF}
								/>
							</div>
						</div>
					) : (
						<div id="schedule-section">
							<ScheduleBuilder
								events={events}
								nameColors={nameColors}
								year={year}
								month={month}
								selectedDay={selectedDay}
								assignments={assignments}
								functionsByEvent={functionsByEvent}
								eventMeta={eventMeta}
								onAssign={handleAssign}
								onFunctionsChange={setFunctionsByEvent}
								onEventMetaChange={setEventMeta}
								onGeneratePDF={handleGenerateBuilderPDF}
							/>
						</div>
					)}
				</>
			)}

			{/* ── Copy toast ─────────────────────────────────── */}
			<output
				aria-live="polite"
				style={{
					position: "fixed",
					bottom: 28,
					left: "50%",
					transform: copiedName ? "translate(-50%, 0)" : "translate(-50%, 6px)",
					opacity: copiedName ? 1 : 0,
					transition: "opacity 200ms ease, transform 200ms ease",
					pointerEvents: "none",
					zIndex: 9999,
					display: "flex",
					alignItems: "center",
					gap: 7,
					padding: "9px 16px",
					background: "var(--surface-raised)",
					border: "1px solid rgba(78,158,126,0.3)",
					borderRadius: 99,
					fontSize: 13,
					fontWeight: 600,
					color: "var(--emerald)",
					whiteSpace: "nowrap",
					boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
				}}
			>
				<Check size={13} strokeWidth={2.5} />
				{copiedName} copiado
			</output>

			{/* Responsive grid override */}
			<style>{`
        @media (max-width: 680px) {
          .main-grid {
            grid-template-columns: 1fr !important;
          }
          .main-grid > div:first-child {
            position: static !important;
          }
        }
      `}</style>
		</div>
	);
}

function ModeButton({
	active,
	children,
	onClick,
}: {
	active: boolean;
	children: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			role="tab"
			aria-selected={active}
			onClick={onClick}
			style={{
				minWidth: 136,
				padding: "8px 13px",
				border: "1px solid transparent",
				borderRadius: 6,
				background: active ? "var(--surface-raised)" : "transparent",
				color: active ? "var(--ink)" : "var(--ink-2)",
				fontSize: 13,
				fontWeight: 800,
				cursor: "pointer",
			}}
		>
			{children}
		</button>
	);
}
