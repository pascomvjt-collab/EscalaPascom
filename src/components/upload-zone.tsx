import { FileCheck, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";

interface Props {
	onFile: (file: File) => void;
	onError: (message: string) => void;
	fileName?: string | null;
	error?: string | null;
}

export function UploadZone({ onFile, onError, fileName, error }: Props) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [dragOver, setDragOver] = useState(false);

	function pick(f: File | undefined | null) {
		if (!f) return;
		if (!f.name.toLowerCase().endsWith(".csv")) {
			onError("Selecione um arquivo .csv.");
			return;
		}
		onFile(f);
	}

	if (fileName) {
		return (
			<>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 10,
						padding: "10px 14px",
						background: "var(--surface)",
						border: "1px solid var(--line)",
						borderRadius: 8,
						marginBottom: error ? 10 : 28,
					}}
				>
					<FileCheck size={15} color="var(--emerald)" strokeWidth={2} />
					<span
						style={{
							fontSize: 13,
							fontWeight: 600,
							color: "var(--ink)",
							flex: 1,
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
						}}
					>
						{fileName}
					</span>
					<button
						type="button"
						onClick={() => inputRef.current?.click()}
						style={{
							fontSize: 12,
							fontWeight: 600,
							color: "var(--ink-2)",
							cursor: "pointer",
							background: "none",
							border: "none",
							padding: "2px 8px",
							borderRadius: 5,
							transition: "color 120ms ease",
							flexShrink: 0,
						}}
						onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink)")}
						onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-2)")}
					>
						Trocar arquivo
					</button>
					<input
						ref={inputRef}
						type="file"
						accept=".csv"
						style={{ display: "none" }}
						onChange={(e) => {
							pick(e.target.files?.[0]);
							e.currentTarget.value = "";
						}}
					/>
				</div>
				{error && <UploadError message={error} />}
			</>
		);
	}

	return (
		<>
			<button
				type="button"
				aria-label="Carregar planilha CSV"
				onClick={() => inputRef.current?.click()}
				onDragOver={(e) => {
					e.preventDefault();
					setDragOver(true);
				}}
				onDragLeave={() => setDragOver(false)}
				onDrop={(e) => {
					e.preventDefault();
					setDragOver(false);
					pick(e.dataTransfer.files[0]);
				}}
				style={{
					maxWidth: 460,
					margin: `8px auto ${error ? 12 : 40}px`,
					border: `1.5px dashed ${dragOver ? "var(--gold)" : "var(--line-strong)"}`,
					borderRadius: 12,
					padding: "40px 24px",
					textAlign: "center",
					cursor: "pointer",
					display: "block",
					width: "100%",
					font: "inherit",
					background: dragOver ? "var(--gold-glow)" : "var(--surface)",
					transition: "border-color 150ms ease, background 150ms ease",
					userSelect: "none",
				}}
			>
				<UploadCloud
					size={32}
					color="var(--ink-3)"
					style={{ margin: "0 auto 16px", display: "block" }}
				/>
				<p
					style={{
						fontSize: 15,
						fontWeight: 700,
						color: "var(--ink)",
						marginBottom: 6,
					}}
				>
					Carregar planilha de escala
				</p>
				<p
					style={{
						fontSize: 13,
						color: "var(--ink-2)",
						marginBottom: 22,
						lineHeight: 1.5,
					}}
				>
					Arraste um arquivo .csv aqui ou clique para selecionar
				</p>
				<span
					style={{
						display: "inline-flex",
						padding: "9px 24px",
						background: "var(--gold)",
						color: "#0e0f1a",
						border: "none",
						borderRadius: 6,
						fontSize: 13,
						fontWeight: 700,
						cursor: "pointer",
						letterSpacing: "0.01em",
					}}
				>
					Selecionar CSV
				</span>
			</button>
			<input
				ref={inputRef}
				type="file"
				accept=".csv"
				style={{ display: "none" }}
				onChange={(e) => {
					pick(e.target.files?.[0]);
					e.currentTarget.value = "";
				}}
			/>
			{error && <UploadError message={error} />}
		</>
	);
}

function UploadError({ message }: { message: string }) {
	return (
		<p
			role="alert"
			style={{
				maxWidth: 460,
				margin: "0 auto 40px",
				padding: "10px 12px",
				borderRadius: 8,
				border: "1px solid rgba(196,104,112,0.45)",
				background: "rgba(196,104,112,0.12)",
				color: "#e08a91",
				fontSize: 13,
				fontWeight: 600,
				lineHeight: 1.45,
			}}
		>
			{message}
		</p>
	);
}
