import { Check, Download, Plus, Trash2, UsersRound, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { EscalaEvent, NameColorMap } from "#/types";

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
const DEFAULT_FUNCTIONS = [
	"Panasonic P",
	"Canon",
	"Fotografia",
	"Storymaker",
	"auxiliares",
	"Diretores",
];

export const LITURGICAL_TIMES = [
	{ id: "comum", label: "Tempo comum", color: "#5f9b74" },
	{ id: "advento", label: "Advento", color: "#9171b8" },
	{ id: "natal", label: "Natal", color: "#d6c27a" },
	{ id: "quaresma", label: "Quaresma", color: "#7f63aa" },
	{ id: "pascoa", label: "Páscoa", color: "#e2d7a6" },
	{ id: "pentecostes", label: "Pentecostes", color: "#c46870" },
	{ id: "maria", label: "Maria/Santos", color: "#d9dde8" },
	{ id: "martires", label: "Mártires", color: "#c46870" },
] as const;
export const SHIFT_OPTIONS = [
	{ id: "manha", label: "Manhã" },
	{ id: "tarde", label: "Tarde" },
	{ id: "noite", label: "Noite" },
] as const;

export type AssignmentMap = Record<string, string[]>;
export type LiturgicalTime = (typeof LITURGICAL_TIMES)[number]["id"];
export type EventShift = (typeof SHIFT_OPTIONS)[number]["id"];

interface Props {
	events: EscalaEvent[];
	nameColors: NameColorMap;
	year: number;
	month: number;
	selectedDay: number | null;
	assignments: AssignmentMap;
	functionsByEvent: ManualFunctions;
	eventMeta: EventMetaMap;
	onAssign: (key: string, volunteers: string[]) => void;
	onFunctionsChange: (
		updater: (current: ManualFunctions) => ManualFunctions,
	) => void;
	onEventMetaChange: (updater: (current: EventMetaMap) => EventMetaMap) => void;
	onGeneratePDF: () => void;
}

export interface BuilderEvent {
	id: string;
	day: number;
	title: string;
	time: string | null;
	volunteers: string[];
	isCabeamento: boolean;
}

export interface BuilderFunction {
	id: string;
	eventId: string;
	label: string;
}

export type ManualFunctions = Record<string, BuilderFunction[]>;
export type EventMetaMap = Record<
	string,
	{
		title?: string;
		groupTitle?: string;
		liturgicalTime?: LiturgicalTime;
		time?: string;
		shift?: EventShift;
		isCabeamento?: boolean;
	}
>;

export function getEventId(event: EscalaEvent): string {
	return `${event.year}-${event.month + 1}-${event.day}-${event.colHeader}`;
}

export function getBuilderEvent(event: EscalaEvent): BuilderEvent {
	return {
		id: getEventId(event),
		day: event.day,
		title: event.title,
		time: event.time,
		volunteers: event.names,
		isCabeamento: event.isCabeamento,
	};
}

export function getAssignmentKey(fn: BuilderFunction): string {
	return fn.id;
}

function uniqueNames(names: string[]): string[] {
	return Array.from(
		new Set(names.map((name) => name.trim()).filter(Boolean)),
	).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function safeId(value: string): string {
	return value.replace(/[^a-z0-9_-]/gi, "-");
}

export function getLiturgicalTimeOption(id?: LiturgicalTime) {
	return (
		LITURGICAL_TIMES.find((time) => time.id === (id ?? "comum")) ??
		LITURGICAL_TIMES[0]
	);
}

export function inferShiftFromTime(time?: string | null): EventShift {
	const match = time?.match(/(\d{1,2})/);
	const hour = match ? Number(match[1]) : Number.NaN;

	if (Number.isNaN(hour)) return "noite";
	if (hour < 12) return "manha";
	if (hour < 18) return "tarde";
	return "noite";
}

export function getShiftOption(id?: EventShift) {
	return SHIFT_OPTIONS.find((shift) => shift.id === id) ?? SHIFT_OPTIONS[2];
}

export function ScheduleBuilder({
	events,
	nameColors,
	year,
	month,
	selectedDay,
	assignments,
	functionsByEvent,
	eventMeta,
	onAssign,
	onFunctionsChange,
	onEventMetaChange,
	onGeneratePDF,
}: Props) {
	const [activeFunctionId, setActiveFunctionId] = useState<string | null>(null);
	const [activeEventId, setActiveEventId] = useState<string | null>(null);
	const [draftByEvent, setDraftByEvent] = useState<Record<string, string>>({});

	const builderEvents = useMemo(
		() =>
			events
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
				}),
		[events, month, selectedDay, year],
	);

	const eventsByDay = useMemo(() => {
		const grouped: Record<number, BuilderEvent[]> = {};
		for (const event of builderEvents) {
			if (!grouped[event.day]) grouped[event.day] = [];
			grouped[event.day].push(event);
		}
		return grouped;
	}, [builderEvents]);

	const days = Object.keys(eventsByDay)
		.map(Number)
		.sort((a, b) => a - b);
	const allFunctions = Object.values(functionsByEvent).flat();
	const activeFunction =
		allFunctions.find((fn) => fn.id === activeFunctionId) ?? null;
	const activeEvent = activeFunction
		? (builderEvents.find((event) => event.id === activeFunction.eventId) ??
			null)
		: activeEventId
			? (builderEvents.find((event) => event.id === activeEventId) ?? null)
			: null;
	const assignedCount = allFunctions.filter(
		(fn) => (assignments[fn.id] ?? []).length > 0,
	).length;

	function addFunction(event: BuilderEvent, labelOverride?: string) {
		const label = (labelOverride ?? draftByEvent[event.id])?.trim();
		if (!label) return;

		const fn: BuilderFunction = {
			id: `${event.id}-function-${Date.now()}-${Math.random().toString(36).slice(2)}`,
			eventId: event.id,
			label,
		};

		onFunctionsChange((current) => ({
			...current,
			[event.id]: [...(current[event.id] ?? []), fn],
		}));
		setDraftByEvent((current) => ({ ...current, [event.id]: "" }));
		setActiveEventId(event.id);
		setActiveFunctionId(fn.id);
	}

	function selectEvent(event: BuilderEvent) {
		setActiveEventId(event.id);
		setActiveFunctionId(null);
	}

	function hasFunction(eventId: string, label: string): boolean {
		return (functionsByEvent[eventId] ?? []).some(
			(fn) => fn.label.toLowerCase() === label.toLowerCase(),
		);
	}

	function removeFunction(fn: BuilderFunction) {
		onFunctionsChange((current) => ({
			...current,
			[fn.eventId]: (current[fn.eventId] ?? []).filter(
				(item) => item.id !== fn.id,
			),
		}));
		onAssign(fn.id, []);
		if (activeFunctionId === fn.id) setActiveFunctionId(null);
	}

	function toggleVolunteer(name: string) {
		if (!activeFunction) return;
		const current = assignments[activeFunction.id] ?? [];
		const next = current.includes(name)
			? current.filter((item) => item !== name)
			: [...current, name];
		onAssign(activeFunction.id, next);
	}

	function getEventTitle(event: BuilderEvent): string {
		return eventMeta[event.id]?.title?.trim() || event.title;
	}

	function getEventGroupTitle(event: BuilderEvent): string {
		return eventMeta[event.id]?.groupTitle ?? "";
	}

	function getLiturgicalTime(event: BuilderEvent) {
		return getLiturgicalTimeOption(eventMeta[event.id]?.liturgicalTime);
	}

	function getEventTime(event: BuilderEvent): string {
		return eventMeta[event.id]?.time ?? event.time ?? "";
	}

	function getEventShift(event: BuilderEvent): EventShift {
		return eventMeta[event.id]?.shift ?? inferShiftFromTime(getEventTime(event));
	}

	function updateEventTitle(event: BuilderEvent, title: string) {
		onEventMetaChange((current) => ({
			...current,
			[event.id]: { ...current[event.id], title },
		}));
	}

	function updateEventGroupTitle(event: BuilderEvent, groupTitle: string) {
		onEventMetaChange((current) => ({
			...current,
			[event.id]: { ...current[event.id], groupTitle },
		}));
	}

	function updateLiturgicalTime(
		event: BuilderEvent,
		liturgicalTime: LiturgicalTime,
	) {
		onEventMetaChange((current) => ({
			...current,
			[event.id]: { ...current[event.id], liturgicalTime },
		}));
	}

	function updateEventTime(event: BuilderEvent, time: string) {
		onEventMetaChange((current) => ({
			...current,
			[event.id]: { ...current[event.id], time },
		}));
	}

	function updateEventShift(event: BuilderEvent, shift: EventShift) {
		onEventMetaChange((current) => ({
			...current,
			[event.id]: { ...current[event.id], shift },
		}));
	}

	function getEventIsCabeamento(event: BuilderEvent): boolean {
		return eventMeta[event.id]?.isCabeamento ?? event.isCabeamento;
	}

	function updateEventIsCabeamento(event: BuilderEvent, value: boolean) {
		onEventMetaChange((current) => ({
			...current,
			[event.id]: { ...current[event.id], isCabeamento: value },
		}));
	}

	function groupEvents(event: BuilderEvent, targetEvent: BuilderEvent) {
		const eventShift = getEventShift(event);
		const targetMeta = eventMeta[targetEvent.id];
		const groupTitle =
			eventMeta[event.id]?.groupTitle?.trim() ||
			targetMeta?.groupTitle?.trim() ||
			`${getEventTitle(event)} + ${getEventTitle(targetEvent)}`;

		onEventMetaChange((current) => ({
			...current,
			[event.id]: {
				...current[event.id],
				groupTitle,
				shift: eventShift,
			},
			[targetEvent.id]: {
				...current[targetEvent.id],
				groupTitle,
				shift: eventShift,
			},
		}));
	}

	function clearEventGroup(event: BuilderEvent) {
		onEventMetaChange((current) => ({
			...current,
			[event.id]: { ...current[event.id], groupTitle: "" },
		}));
	}

	if (days.length === 0) {
		return (
			<div
				style={{
					padding: "48px 0",
					textAlign: "center",
					color: "var(--ink-3)",
					fontSize: 13,
				}}
			>
				Nenhum evento para montar em {PT_MONTHS[month]} de {year}
			</div>
		);
	}

	return (
		<div className="fade-up">
			<div
				style={{
					display: "flex",
					alignItems: "flex-end",
					justifyContent: "space-between",
					gap: 16,
					marginBottom: 16,
					flexWrap: "wrap",
				}}
			>
				<div>
					<h2
						style={{
							fontFamily: "Fraunces, Georgia, serif",
							fontSize: "1.28rem",
							fontWeight: 500,
							color: "var(--ink)",
							lineHeight: 1.18,
						}}
					>
						Montagem da escala
					</h2>
					<p style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 5 }}>
						Dias, eventos, funções e voluntários em uma única página
					</p>
				</div>

				<div
					style={{
						display: "inline-flex",
						alignItems: "center",
						gap: 8,
					}}
				>
					<div
						style={{
							display: "inline-flex",
							alignItems: "center",
							gap: 8,
							padding: "7px 10px",
							border: "1px solid var(--line)",
							borderRadius: 8,
							background: "var(--surface)",
							color: "var(--ink-2)",
							fontSize: 12,
							fontWeight: 700,
						}}
					>
						<span style={{ color: "var(--ink)" }}>{assignedCount}</span>
						<span>de</span>
						<span style={{ color: "var(--ink)" }}>{allFunctions.length}</span>
						<span>funções atribuídas</span>
					</div>

					<button
						type="button"
						onClick={onGeneratePDF}
						style={{
							display: "inline-flex",
							alignItems: "center",
							gap: 7,
							padding: "8px 12px",
							border: "1px solid rgba(196,154,69,0.42)",
							borderRadius: 8,
							background: "var(--gold-dim)",
							color: "var(--gold)",
							fontSize: 12,
							fontWeight: 800,
							cursor: "pointer",
						}}
					>
						<Download size={14} strokeWidth={2.4} />
						Gerar PDF
					</button>
				</div>
			</div>

			<div
				className="builder-page-grid"
				style={{
					display: "grid",
					gridTemplateColumns: "minmax(0, 1fr) minmax(286px, 330px)",
					gap: 18,
					alignItems: "start",
				}}
			>
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						gap: 16,
					}}
				>
					<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
						{days.map((day) => {
							const dayEvents = eventsByDay[day] ?? [];
							const dow = PT_DAYS_FULL[new Date(year, month, day).getDay()];

							return (
								<section
									key={day}
									style={{
										background: "var(--surface)",
										border: "1px solid var(--line)",
										borderRadius: 8,
										overflow: "hidden",
									}}
								>
									<header
										style={{
											display: "flex",
											alignItems: "center",
											justifyContent: "space-between",
											gap: 12,
											padding: "13px 14px",
											borderBottom: "1px solid var(--line)",
											background:
												"linear-gradient(180deg, rgba(196,154,69,0.11), rgba(255,255,255,0.015))",
										}}
									>
										<div>
											<div
												style={{
													fontSize: 15,
													fontWeight: 800,
													color: "var(--ink)",
													lineHeight: 1.2,
												}}
											>
												{String(day).padStart(2, "0")} de {PT_MONTHS[month]}
											</div>
											<div
												style={{
													fontSize: 12,
													color: "var(--ink-2)",
													marginTop: 3,
												}}
											>
												{dow}
											</div>
										</div>
										<span
											style={{
												padding: "5px 9px",
												borderRadius: 999,
												background: "rgba(255,255,255,0.05)",
												color: "var(--gold)",
												fontSize: 12,
												fontWeight: 800,
											}}
										>
											{dayEvents.length} evento
											{dayEvents.length !== 1 ? "s" : ""}
										</span>
									</header>

									<div
										style={{
											display: "grid",
											gridTemplateColumns:
												"repeat(auto-fit, minmax(280px, 1fr))",
											gap: 12,
											padding: 12,
										}}
									>
										{dayEvents.map((event) => {
											const eventFunctions = functionsByEvent[event.id] ?? [];
											const liturgicalTime = getLiturgicalTime(event);
											const eventTime = getEventTime(event);
											const eventShift = getEventShift(event);
											const eventGroupTitle = getEventGroupTitle(event);
											const isCabeamento = getEventIsCabeamento(event);
											const groupableEvents = dayEvents.filter(
												(item) => item.id !== event.id,
											);

											return (
												<div
													key={event.id}
													style={{
														display: "flex",
														flexDirection: "column",
														minHeight: 220,
														padding: 12,
														border:
															activeEvent?.id === event.id && !activeFunction
																? "1px solid rgba(196,154,69,0.48)"
																: "1px solid var(--line)",
														borderRadius: 8,
														background: `linear-gradient(90deg, ${liturgicalTime.color}24 0 4px, var(--surface-raised) 4px)`,
													}}
												>
													<div
														style={{
															marginBottom: 10,
														}}
													>
														<div
															style={{
																display: "grid",
																gridTemplateColumns:
																	"1fr minmax(104px, 128px) minmax(88px, 108px) minmax(78px, 96px)",
																gap: 8,
																alignItems: "center",
															}}
														>
															<input
																value={getEventTitle(event)}
																onChange={(inputEvent) =>
																	updateEventTitle(
																		event,
																		inputEvent.target.value,
																	)
																}
																style={{
																	width: "100%",
																	minWidth: 0,
																	border: "1px solid var(--line)",
																	borderRadius: 6,
																	background: "rgba(255,255,255,0.035)",
																	color: "var(--ink)",
																	padding: "8px 9px",
																	fontSize: 13,
																	fontWeight: 800,
																	outline: "none",
																}}
															/>
															<select
																value={liturgicalTime.id}
																onChange={(selectEvent) =>
																	updateLiturgicalTime(
																		event,
																		selectEvent.target.value as LiturgicalTime,
																	)
																}
																style={{
																	width: "100%",
																	minWidth: 0,
																	border: `1px solid ${liturgicalTime.color}66`,
																	borderRadius: 6,
																	background: "rgba(255,255,255,0.035)",
																	color: "var(--ink)",
																	padding: "8px 7px",
																	fontSize: 12,
																	fontWeight: 700,
																	outline: "none",
																}}
															>
																{LITURGICAL_TIMES.map((time) => (
																	<option key={time.id} value={time.id}>
																		{time.label}
																	</option>
																))}
															</select>
															<select
																value={eventShift}
																onChange={(selectEvent) =>
																	updateEventShift(
																		event,
																		selectEvent.target.value as EventShift,
																	)
																}
																style={{
																	width: "100%",
																	minWidth: 0,
																	border: "1px solid var(--line)",
																	borderRadius: 6,
																	background: "rgba(255,255,255,0.035)",
																	color: "var(--ink)",
																	padding: "8px 7px",
																	fontSize: 12,
																	fontWeight: 700,
																	outline: "none",
																}}
															>
																{SHIFT_OPTIONS.map((shift) => (
																	<option key={shift.id} value={shift.id}>
																		{shift.label}
																	</option>
																))}
															</select>
															<input
																value={eventTime}
																onChange={(inputEvent) =>
																	updateEventTime(event, inputEvent.target.value)
																}
																placeholder="Horário"
																style={{
																	width: "100%",
																	minWidth: 0,
																	border: "1px solid var(--line)",
																	borderRadius: 6,
																	background: "rgba(255,255,255,0.035)",
																	color: "var(--ink)",
																	padding: "8px 7px",
																	fontSize: 12,
																	fontWeight: 700,
																	outline: "none",
																}}
															/>
														</div>
														<div
															style={{
																display: "grid",
																gridTemplateColumns:
																	"minmax(0, 1fr) minmax(130px, 170px) auto",
																gap: 8,
																marginTop: 8,
															}}
														>
															<input
																value={eventGroupTitle}
																onChange={(inputEvent) =>
																	updateEventGroupTitle(
																		event,
																		inputEvent.target.value,
																	)
																}
																placeholder="Grupo do evento (opcional)"
																style={{
																	width: "100%",
																	minWidth: 0,
																	border: "1px solid var(--line)",
																	borderRadius: 6,
																	background: "rgba(255,255,255,0.035)",
																	color: "var(--ink)",
																	padding: "8px 9px",
																	fontSize: 12,
																	fontWeight: 700,
																	outline: "none",
																}}
															/>
															<select
																value=""
																disabled={groupableEvents.length === 0}
																onChange={(selectEvent) => {
																	const targetEvent = dayEvents.find(
																		(item) =>
																			item.id === selectEvent.target.value,
																	);
																	if (targetEvent) groupEvents(event, targetEvent);
																}}
																style={{
																	width: "100%",
																	minWidth: 0,
																	border: "1px solid var(--line)",
																	borderRadius: 6,
																	background: "rgba(255,255,255,0.035)",
																	color: "var(--ink)",
																	padding: "8px 7px",
																	fontSize: 12,
																	fontWeight: 700,
																	outline: "none",
																	cursor:
																		groupableEvents.length === 0
																			? "not-allowed"
																			: "pointer",
																}}
															>
																<option value="">Agrupar com...</option>
																{groupableEvents.map((item) => (
																	<option key={item.id} value={item.id}>
																		{getEventTitle(item)}
																	</option>
																))}
															</select>
															<button
																type="button"
																disabled={!eventGroupTitle.trim()}
																onClick={() => clearEventGroup(event)}
																style={{
																	padding: "8px 9px",
																	border: "1px solid var(--line)",
																	borderRadius: 6,
																	background: "rgba(255,255,255,0.035)",
																	color: eventGroupTitle.trim()
																		? "var(--ink-2)"
																		: "var(--ink-3)",
																	fontSize: 12,
																	fontWeight: 800,
																	cursor: eventGroupTitle.trim()
																		? "pointer"
																		: "not-allowed",
																}}
															>
																Limpar
															</button>
														</div>
														<label
															style={{
																display: "inline-flex",
																alignItems: "center",
																gap: 6,
																marginTop: 8,
																fontSize: 12,
																fontWeight: 700,
																color: getEventIsCabeamento(event)
																	? "var(--ink)"
																	: "var(--ink-2)",
																cursor: "pointer",
																userSelect: "none",
															}}
														>
															<input
																type="checkbox"
																checked={getEventIsCabeamento(event)}
																onChange={(e) =>
																	updateEventIsCabeamento(event, e.target.checked)
																}
																style={{ cursor: "pointer", accentColor: "var(--gold)" }}
															/>
															Cabeamento
														</label>
														<div
															style={{
																display: "flex",
																alignItems: "center",
																justifyContent: "space-between",
																gap: 10,
																marginTop: 7,
															}}
														>
															<div
																style={{
																	fontSize: 11,
																	color: "var(--ink-2)",
																}}
															>
																{getShiftOption(eventShift).label}
																{eventTime ? ` · ${eventTime} · ` : " · "}
																{event.volunteers.length} disponível
																{event.volunteers.length !== 1 ? "is" : ""}
															</div>
															<div
																style={{
																	display: "inline-flex",
																	alignItems: "center",
																	gap: 6,
																	flexShrink: 0,
																}}
															>
																<span
																	style={{
																		padding: "3px 7px",
																		borderRadius: 999,
																		background: `${liturgicalTime.color}22`,
																		color: liturgicalTime.color,
																		fontSize: 11,
																		fontWeight: 800,
																	}}
																>
																	{eventFunctions.length} função
																	{eventFunctions.length !== 1 ? "es" : ""}
																</span>
																<button
																	type="button"
																	onClick={() => selectEvent(event)}
																	style={{
																		padding: "3px 7px",
																		borderRadius: 999,
																		border: "1px solid var(--line)",
																		background: "rgba(255,255,255,0.04)",
																		color: "var(--ink-2)",
																		fontSize: 11,
																		fontWeight: 800,
																		cursor: "pointer",
																	}}
																>
																	Ver disponíveis
																</button>
															</div>
														</div>
													</div>

													{!isCabeamento && (
														<>
													{eventFunctions.length === 0 && (
														<p
															style={{
																marginBottom: 8,
																padding: "8px 9px",
																border: "1px dashed var(--line-strong)",
																borderRadius: 7,
																color: "var(--ink-3)",
																fontSize: 12,
															}}
														>
															Nenhuma função criada neste evento.
														</p>
													)}

													<div
														style={{
															display: "flex",
															flexDirection: "column",
															gap: 7,
														}}
													>
														{eventFunctions.map((fn) => {
															const assigned = assignments[fn.id] ?? [];
															const isActive = fn.id === activeFunctionId;

															return (
																<div
																	key={fn.id}
																	style={{
																		display: "grid",
																		gridTemplateColumns: "1fr auto",
																		gap: 8,
																		alignItems: "center",
																		padding: "9px 10px",
																		borderRadius: 8,
																		background: isActive
																			? "rgba(196,154,69,0.12)"
																			: "rgba(255,255,255,0.035)",
																		border: `1px solid ${
																			isActive
																				? "rgba(196,154,69,0.48)"
																				: "var(--line)"
																		}`,
																	}}
																>
																	<button
																		type="button"
																		onClick={(clickEvent) => {
																			clickEvent.stopPropagation();
																			setActiveEventId(event.id);
																			setActiveFunctionId(fn.id);
																		}}
																		style={{
																			minWidth: 0,
																			border: 0,
																			background: "transparent",
																			color: "inherit",
																			cursor: "pointer",
																			textAlign: "left",
																			font: "inherit",
																		}}
																	>
																		<span
																			style={{
																				display: "block",
																				fontSize: 13,
																				fontWeight: 800,
																				color: "var(--ink)",
																				overflow: "hidden",
																				textOverflow: "ellipsis",
																				whiteSpace: "nowrap",
																			}}
																		>
																			{fn.label}
																		</span>
																		<span
																			style={{
																				display: "block",
																				fontSize: 12,
																				marginTop: 3,
																				color:
																					assigned.length > 0
																						? "var(--emerald)"
																						: "var(--ink-2)",
																				overflow: "hidden",
																				textOverflow: "ellipsis",
																				whiteSpace: "nowrap",
																			}}
																		>
																			{assigned.length > 0
																				? assigned.join("; ")
																				: "Sem voluntário"}
																		</span>
																	</button>

																	<button
																		type="button"
																		aria-label={`Remover ${fn.label}`}
																		onClick={(clickEvent) => {
																			clickEvent.stopPropagation();
																			removeFunction(fn);
																		}}
																		style={{
																			width: 28,
																			height: 28,
																			display: "inline-flex",
																			alignItems: "center",
																			justifyContent: "center",
																			border: "1px solid var(--line)",
																			borderRadius: 6,
																			background: "transparent",
																			color: "var(--ink-2)",
																			cursor: "pointer",
																		}}
																	>
																		<Trash2 size={13} />
																	</button>
																</div>
															);
														})}
													</div>

													<div
														style={{
															display: "grid",
															gridTemplateColumns: "1fr auto",
															gap: 7,
															marginTop: "auto",
															paddingTop: 10,
														}}
													>
														<input
															value={draftByEvent[event.id] ?? ""}
															onChange={(inputEvent) =>
																setDraftByEvent((current) => ({
																	...current,
																	[event.id]: inputEvent.target.value,
																}))
															}
															onKeyDown={(keyEvent) => {
																keyEvent.stopPropagation();
																if (keyEvent.key === "Enter")
																	addFunction(event);
															}}
															onClick={(clickEvent) =>
																clickEvent.stopPropagation()
															}
															list={`functions-${safeId(event.id)}`}
															placeholder="Adicionar função"
															style={{
																width: "100%",
																minWidth: 0,
																border: "1px solid var(--line)",
																borderRadius: 6,
																background: "rgba(255,255,255,0.03)",
																color: "var(--ink)",
																padding: "8px 9px",
																fontSize: 12,
																outline: "none",
															}}
														/>
														<datalist id={`functions-${safeId(event.id)}`}>
															{DEFAULT_FUNCTIONS.map((fn) => (
																<option key={fn} value={fn} />
															))}
														</datalist>
														<button
															type="button"
															onClick={(clickEvent) => {
																clickEvent.stopPropagation();
																addFunction(event);
															}}
															aria-label={`Adicionar função em ${getEventTitle(event)}`}
															style={{
																width: 36,
																border: "1px solid rgba(196,154,69,0.35)",
																borderRadius: 6,
																background: "var(--gold-dim)",
																color: "var(--gold)",
																display: "inline-flex",
																alignItems: "center",
																justifyContent: "center",
																cursor: "pointer",
															}}
														>
															<Plus size={16} strokeWidth={2.6} />
														</button>
													</div>
													<div
														style={{
															display: "flex",
															flexWrap: "wrap",
															gap: 6,
															marginTop: 8,
														}}
													>
														{DEFAULT_FUNCTIONS.map((fn) => {
															const alreadyAdded = hasFunction(event.id, fn);

															return (
																<button
																	key={fn}
																	type="button"
																	disabled={alreadyAdded}
																	onClick={(clickEvent) => {
																		clickEvent.stopPropagation();
																		addFunction(event, fn);
																	}}
																	style={{
																		padding: "5px 8px",
																		borderRadius: 999,
																		border: "1px solid var(--line)",
																		background: alreadyAdded
																			? "rgba(255,255,255,0.025)"
																			: "rgba(255,255,255,0.045)",
																		color: alreadyAdded
																			? "var(--ink-3)"
																			: "var(--ink-2)",
																		fontSize: 11,
																		fontWeight: 700,
																		cursor: alreadyAdded
																			? "default"
																			: "pointer",
																	}}
																>
																	{fn}
																</button>
															);
														})}
													</div>
														</>
													)}
													{isCabeamento && (
														<div
															style={{
																display: "flex",
																flexWrap: "wrap",
																gap: 5,
																marginTop: "auto",
																paddingTop: 10,
															}}
														>
															{event.volunteers.length === 0 ? (
																<p style={{ fontSize: 12, color: "var(--ink-3)" }}>
																	Nenhum disponível.
																</p>
															) : (
																uniqueNames(event.volunteers).map((name) => {
																	const cabeamentoKey = `${event.id}-cabeamento`;
																	const selected = (assignments[cabeamentoKey] ?? []).includes(name);
																	return (
																		<button
																			key={name}
																			type="button"
																			className={`name-tag nc-${nameColors[name] ?? 0}`}
																			style={{
																				justifyContent: "space-between",
																				outline: selected ? "2px solid currentColor" : "none",
																				outlineOffset: 1,
																			}}
																			onClick={() => {
																				const current = assignments[cabeamentoKey] ?? [];
																				const next = selected
																					? current.filter((n) => n !== name)
																					: [...current, name];
																				onAssign(cabeamentoKey, next);
																			}}
																		>
																			{name}
																			{selected && <Check size={11} strokeWidth={2.5} />}
																		</button>
																	);
																})
															)}
														</div>
													)}
												</div>
											);
										})}
									</div>
								</section>
							);
						})}
					</div>
				</div>

				<aside
					style={{
						position: "sticky",
						top: 24,
						background: "var(--surface)",
						border: "1px solid var(--line)",
						borderRadius: 8,
						padding: 14,
					}}
				>
					{activeFunction && activeEvent ? (
						<>
							<div style={{ marginBottom: 14 }}>
								<div
									style={{
										fontSize: 11,
										fontWeight: 800,
										color: "var(--ink-2)",
										letterSpacing: "0.08em",
										textTransform: "uppercase",
										marginBottom: 7,
									}}
								>
									Atribuir voluntários
								</div>
								<div
									style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)" }}
								>
									{activeFunction.label}
								</div>
								<div
									style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 3 }}
								>
									{getEventTitle(activeEvent)} ·{" "}
									{String(activeEvent.day).padStart(2, "0")} de{" "}
									{PT_MONTHS[month]}
								</div>
							</div>

							<div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
								{uniqueNames(activeEvent.volunteers).map((name) => {
									const selected = (
										assignments[activeFunction.id] ?? []
									).includes(name);

									return (
										<button
											key={name}
											type="button"
											onClick={() => toggleVolunteer(name)}
											className={`name-tag nc-${nameColors[name] ?? 0}`}
											style={{
												width: "100%",
												justifyContent: "space-between",
												borderRadius: 7,
												padding: "8px 10px",
												font: "inherit",
											}}
										>
											{name}
											{selected && <Check size={13} strokeWidth={2.5} />}
										</button>
									);
								})}
							</div>

							{activeEvent.volunteers.length === 0 && (
								<p style={{ fontSize: 12, color: "var(--ink-3)" }}>
									Nenhum voluntário disponível para este evento.
								</p>
							)}

							{(assignments[activeFunction.id] ?? []).length > 0 && (
								<button
									type="button"
									onClick={() => onAssign(activeFunction.id, [])}
									style={{
										width: "100%",
										marginTop: 12,
										display: "inline-flex",
										alignItems: "center",
										justifyContent: "center",
										gap: 6,
										padding: "8px 10px",
										borderRadius: 6,
										border: "1px solid var(--line)",
										background: "transparent",
										color: "var(--ink-2)",
										fontSize: 12,
										fontWeight: 800,
										cursor: "pointer",
									}}
								>
									<X size={13} />
									Limpar atribuições
								</button>
							)}
						</>
					) : activeEvent ? (
						<>
							<div style={{ marginBottom: 14 }}>
								<div
									style={{
										fontSize: 11,
										fontWeight: 800,
										color: "var(--ink-2)",
										letterSpacing: "0.08em",
										textTransform: "uppercase",
										marginBottom: 7,
									}}
								>
									Disponíveis no evento
								</div>
								<div
									style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)" }}
								>
									{getEventTitle(activeEvent)}
								</div>
								<div
									style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 3 }}
								>
									{String(activeEvent.day).padStart(2, "0")} de{" "}
									{PT_MONTHS[month]}
									{activeEvent.time ? ` · ${activeEvent.time}` : ""}
								</div>
							</div>

							<div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
								{uniqueNames(activeEvent.volunteers).map((name) => (
									<span
										key={name}
										className={`name-tag nc-${nameColors[name] ?? 0}`}
										style={{
											cursor: "default",
											transform: "none",
										}}
									>
										{name}
									</span>
								))}
							</div>

							{activeEvent.volunteers.length === 0 && (
								<p style={{ fontSize: 12, color: "var(--ink-3)" }}>
									Nenhum voluntário disponível para este evento.
								</p>
							)}
						</>
					) : (
						<div style={{ color: "var(--ink-2)", fontSize: 13 }}>
							<UsersRound size={18} style={{ marginBottom: 10 }} />
							Selecione um evento para ver os voluntários disponíveis ou uma
							função para atribuí-los.
						</div>
					)}
				</aside>
			</div>

			<style>{`
				@media (max-width: 960px) {
					.builder-page-grid {
						grid-template-columns: 1fr !important;
					}
					.builder-page-grid > aside {
						position: static !important;
					}
				}
			`}</style>
		</div>
	);
}
