"use client";

import * as React from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import ptBrLocale from "@fullcalendar/core/locales/pt-br";
import type {
  CalendarApi,
  DatesSetArg,
  DateSelectArg,
  EventClickArg,
  EventContentArg,
  EventDropArg,
  EventInput,
} from "@fullcalendar/core";
import {
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Link2,
  LoaderCircle,
  RefreshCcw,
  Search,
  Unlink2,
  XCircle,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { SelectTenantState } from "@/components/shared/select-tenant-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/lib/toast";
import { useAuth } from "@/providers/auth-provider";
import { useTenant } from "@/providers/tenant-provider";
import { usePagePermission } from "@/hooks/usePagePermission";
import { usePermissions } from "@/providers/permissions-provider";
import { CalendarService } from "@/services/calendar-service";
import type {
  CalendarEvent,
  CalendarEventFormValues,
  GoogleCalendarConnectionStatus,
} from "@/types/calendar";
import {
  buildCalendarFormValuesFromEvent,
  buildCalendarPayloadFromForm,
  CalendarEventDialog,
  createEmptyCalendarFormValues,
} from "./calendar-event-dialog";

const STATUS_LABELS: Record<CalendarEvent["status"], string> = {
  scheduled: "Agendado",
  completed: "Concluido",
  canceled: "Cancelado",
};

const STATUS_BADGES: Record<
  CalendarEvent["status"],
  "default" | "success" | "destructive"
> = {
  scheduled: "default",
  completed: "success",
  canceled: "destructive",
};

function formatDateTime(dateValue: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateValue));
}

function formatDateOnly(dateValue: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "long",
  }).format(new Date(dateValue));
}

function formatRangeLabel(startMs: number, endMs: number): string {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  });

  return `${formatter.format(new Date(startMs))} - ${formatter.format(new Date(endMs))}`;
}

function toDateOnlyFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function buildFormValuesFromSelection(selection: DateSelectArg): CalendarEventFormValues {
  if (selection.allDay) {
    return {
      ...createEmptyCalendarFormValues(),
      isAllDay: true,
      startDate: selection.startStr.slice(0, 10),
      endDate: selection.endStr.slice(0, 10),
    };
  }

  const start = selection.start;
  const end = selection.end || new Date(start.getTime() + 60 * 60 * 1000);

  const toInputValue = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    const hours = String(value.getHours()).padStart(2, "0");
    const minutes = String(value.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  return {
    ...createEmptyCalendarFormValues(),
    isAllDay: false,
    startsAt: toInputValue(start),
    endsAt: toInputValue(end),
  };
}

function buildPayloadFromCalendarMove(
  event:
    | EventDropArg["event"]
    | EventResizeDoneArg["event"],
  current: CalendarEvent,
) {
  if (event.allDay) {
    const startDate = event.startStr.slice(0, 10);
    const endDate = event.endStr
      ? event.endStr.slice(0, 10)
      : toDateOnlyFromDate(new Date(new Date(startDate).getTime() + 24 * 60 * 60 * 1000));

    return {
      title: current.title,
      description: current.description,
      location: current.location,
      status: current.status,
      color: current.color,
      isAllDay: true,
      startDate,
      endDate,
      startsAt: null,
      endsAt: null,
    };
  }

  return {
    title: current.title,
    description: current.description,
    location: current.location,
    status: current.status,
    color: current.color,
    isAllDay: false,
    startsAt: event.start ? event.start.toISOString() : current.startsAt,
    endsAt: event.end ? event.end.toISOString() : current.endsAt,
    startDate: null,
    endDate: null,
  };
}

type CalendarViewType =
  | "dayGridMonth"
  | "timeGridWeek"
  | "timeGridDay"
  | "listWeek";

export function CalendarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { isMaster } = usePermissions();
  const permissions = usePagePermission("calendar");

  const [events, setEvents] = React.useState<CalendarEvent[]>([]);
  const [range, setRange] = React.useState(() => {
    const now = Date.now();
    return {
      startMs: now - 30 * 24 * 60 * 60 * 1000,
      endMs: now + 120 * 24 * 60 * 60 * 1000,
    };
  });
  const [statusFilter, setStatusFilter] = React.useState<
    CalendarEvent["status"][]
  >(["scheduled", "completed", "canceled"]);
  const [searchTerm, setSearchTerm] = React.useState("");
  const deferredSearch = React.useDeferredValue(searchTerm);
  const [showWeekends, setShowWeekends] = React.useState(true);
  const [currentView, setCurrentView] =
    React.useState<CalendarViewType>("dayGridMonth");
  const [currentTitle, setCurrentTitle] = React.useState("");
  const [isLoadingEvents, setIsLoadingEvents] = React.useState(true);
  const [googleStatus, setGoogleStatus] =
    React.useState<GoogleCalendarConnectionStatus>({
      connected: false,
    });
  const [isLoadingGoogle, setIsLoadingGoogle] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<"create" | "edit">(
    "create",
  );
  const [activeEvent, setActiveEvent] = React.useState<CalendarEvent | null>(
    null,
  );
  const [formValues, setFormValues] = React.useState<CalendarEventFormValues>(
    createEmptyCalendarFormValues(),
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = React.useState(false);
  const calendarRef = React.useRef<FullCalendar | null>(null);

  const canCreate = permissions.canCreate || isMaster;
  const canEdit = permissions.canEdit || isMaster;
  const canDelete = permissions.canDelete || isMaster;
  const canManageCompanyCalendar = isMaster;

  const upsertEvent = React.useCallback((nextEvent: CalendarEvent) => {
    setEvents((current) => {
      const filtered = current.filter((event) => event.id !== nextEvent.id);
      filtered.push(nextEvent);
      filtered.sort((a, b) => a.startMs - b.startMs);
      return filtered;
    });
  }, []);

  const removeEvent = React.useCallback((eventId: string) => {
    setEvents((current) => current.filter((event) => event.id !== eventId));
  }, []);

  React.useEffect(() => {
    if (!tenant?.id) {
      setEvents([]);
      setIsLoadingEvents(false);
      return;
    }

    setIsLoadingEvents(true);

    const unsubscribe = CalendarService.subscribeToEvents({
      rangeStartMs: range.startMs,
      rangeEndMs: range.endMs,
      callback: (nextEvents) => {
        setEvents(nextEvents);
        setIsLoadingEvents(false);
      },
      onError: () => {
        setIsLoadingEvents(false);
        toast.error("Nao foi possivel carregar os compromissos.");
      },
    });

    return () => unsubscribe();
  }, [tenant?.id, user?.id, range.startMs, range.endMs]);

  React.useEffect(() => {
    let active = true;

    async function loadGoogleStatus() {
      if (!tenant?.id || !user?.id) {
        if (active) {
          setGoogleStatus({ connected: false });
          setIsLoadingGoogle(false);
        }
        return;
      }

      setIsLoadingGoogle(true);

      try {
        const status = await CalendarService.getGoogleConnectionStatus();
        if (active) {
          setGoogleStatus(status);
        }
      } catch (error) {
        if (active) {
          setGoogleStatus({ connected: false });
        }
        console.error("[CalendarPage] Error loading Google status:", error);
      } finally {
        if (active) {
          setIsLoadingGoogle(false);
        }
      }
    }

    void loadGoogleStatus();

    return () => {
      active = false;
    };
  }, [tenant?.id, user?.id]);

  React.useEffect(() => {
    const googleCalendarStatus = searchParams.get("googleCalendar");
    if (!googleCalendarStatus) {
      return;
    }

    if (googleCalendarStatus === "connected") {
      toast.success("Google Agenda conectado com sucesso.");
    } else {
      toast.error("Nao foi possivel concluir a conexao com o Google Agenda.");
    }

    void CalendarService.getGoogleConnectionStatus()
      .then((status) => setGoogleStatus(status))
      .catch(() => undefined)
      .finally(() => setIsLoadingGoogle(false));

    router.replace("/calendar");
  }, [router, searchParams]);

  const visibleEvents = React.useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();

    return events.filter((event) => {
      if (!statusFilter.includes(event.status)) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [event.title, event.location || "", event.description || ""]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [events, statusFilter, deferredSearch]);

  const upcomingEvents = React.useMemo(() => {
    const now = Date.now();
    return visibleEvents.filter((event) => event.endMs >= now).slice(0, 8);
  }, [visibleEvents]);

  const stats = React.useMemo(() => {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const tomorrowStart = todayStart + 24 * 60 * 60 * 1000;
    const weekEnd = todayStart + 7 * 24 * 60 * 60 * 1000;

    return {
      today: visibleEvents.filter(
        (event) => event.startMs >= todayStart && event.startMs < tomorrowStart,
      ).length,
      week: visibleEvents.filter(
        (event) => event.startMs >= todayStart && event.startMs < weekEnd,
      ).length,
      completed: visibleEvents.filter((event) => event.status === "completed")
        .length,
      canceled: visibleEvents.filter((event) => event.status === "canceled")
        .length,
    };
  }, [visibleEvents]);

  const calendarEvents = React.useMemo<EventInput[]>(
    () =>
      visibleEvents.map((event) => ({
        id: event.id,
        title: event.title,
        start: event.isAllDay ? event.startDate || undefined : event.startsAt || undefined,
        end: event.isAllDay ? event.endDate || undefined : event.endsAt || undefined,
        allDay: event.isAllDay,
        backgroundColor:
          event.status === "canceled" ? `${event.color}18` : `${event.color}20`,
        borderColor: event.color,
        textColor: event.status === "canceled" ? "#9ca3af" : undefined,
        extendedProps: {
          status: event.status,
          location: event.location,
          googleSyncStatus: event.googleSync.status,
        },
      })),
    [visibleEvents],
  );

  function handleOpenCreateDialog(selection?: DateSelectArg) {
    if (!canCreate) return;
    setDialogMode("create");
    setActiveEvent(null);
    setFormValues(
      selection ? buildFormValuesFromSelection(selection) : createEmptyCalendarFormValues(),
    );
    setDialogOpen(true);
  }

  function handleOpenEditDialog(event: CalendarEvent) {
    setDialogMode("edit");
    setActiveEvent(event);
    setFormValues(buildCalendarFormValuesFromEvent(event));
    setDialogOpen(true);
  }

  async function handleSubmitEvent() {
    if (!canCreate && dialogMode === "create") return;
    if (!canEdit && dialogMode === "edit") return;

    const payload = buildCalendarPayloadFromForm(formValues);
    if (!payload.title) {
      toast.error("Informe um titulo para o compromisso.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (dialogMode === "create") {
        const createdEvent = await CalendarService.createEvent(payload);
        upsertEvent(createdEvent);
        toast.success("Compromisso criado.");
      } else if (activeEvent) {
        const updatedEvent = await CalendarService.updateEvent(
          activeEvent.id,
          payload,
        );
        upsertEvent(updatedEvent);
        toast.success("Compromisso atualizado.");
      }

      setDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteEvent() {
    if (!activeEvent || !canDelete) return;

    setIsDeleting(true);

    try {
      await CalendarService.deleteEvent(activeEvent.id);
      removeEvent(activeEvent.id);
      toast.success("Compromisso excluido.");
      setDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao excluir.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleGoogleConnect() {
    setIsConnectingGoogle(true);

    try {
      const authUrl = await CalendarService.getGoogleAuthUrl();
      window.location.assign(authUrl);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel iniciar a conexao com o Google.",
      );
      setIsConnectingGoogle(false);
    }
  }

  async function handleGoogleDisconnect() {
    setIsLoadingGoogle(true);

    try {
      await CalendarService.disconnectGoogleCalendar();
      setGoogleStatus({ connected: false });
      toast.success("Google Agenda desconectado.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel desconectar o Google Agenda.",
      );
    } finally {
      setIsLoadingGoogle(false);
    }
  }

  async function handleEventMove(
    calendarEvent: EventDropArg | EventResizeDoneArg,
  ) {
    if (!canEdit) {
      calendarEvent.revert();
      return;
    }

    const current = events.find((item) => item.id === calendarEvent.event.id);
    if (!current) {
      calendarEvent.revert();
      return;
    }

    try {
      await CalendarService.updateEvent(
        current.id,
        buildPayloadFromCalendarMove(calendarEvent.event, current),
      );
      toast.success("Compromisso reagendado.");
    } catch (error) {
      calendarEvent.revert();
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel reagendar o compromisso.",
      );
    }
  }

  function getCalendarApi(): CalendarApi | null {
    return calendarRef.current?.getApi() || null;
  }

  function handleCalendarViewChange(view: string) {
    const nextView = view as CalendarViewType;
    setCurrentView(nextView);
    getCalendarApi()?.changeView(nextView);
  }

  function handleCalendarNavigation(action: "prev" | "next" | "today") {
    const api = getCalendarApi();
    if (!api) return;

    if (action === "prev") {
      api.prev();
      return;
    }

    if (action === "next") {
      api.next();
      return;
    }

    api.today();
  }

  function renderEventContent(content: EventContentArg) {
    const status = String(content.event.extendedProps.status || "scheduled");
    const location = String(content.event.extendedProps.location || "").trim();
    const syncStatus = String(
      content.event.extendedProps.googleSyncStatus || "disabled",
    );

    return (
      <div className="calendar-event-chip">
        <div className="calendar-event-chip__header">
          <span className="calendar-event-chip__title">{content.event.title}</span>
          {syncStatus === "synced" ? (
            <span
              className="calendar-event-chip__sync"
              title="Sincronizado com Google Agenda"
            >
              G
            </span>
          ) : null}
        </div>
        {content.timeText ? (
          <span className="calendar-event-chip__time">{content.timeText}</span>
        ) : null}
        {location ? (
          <span className="calendar-event-chip__meta">{location}</span>
        ) : null}
        <span
          className={`calendar-event-chip__status calendar-event-chip__status--${status}`}
        >
          {STATUS_LABELS[status as CalendarEvent["status"]]}
        </span>
      </div>
    );
  }

  if (user?.role === "superadmin" && !tenant) {
    return <SelectTenantState title="Selecione uma empresa para ver o calendario" />;
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-3xl border-border/60">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground">Hoje</p>
              <p className="mt-1 text-3xl font-semibold">{stats.today}</p>
            </div>
            <CalendarClock className="h-8 w-8 text-primary" />
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-border/60">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground">Proximos 7 dias</p>
              <p className="mt-1 text-3xl font-semibold">{stats.week}</p>
            </div>
            <CalendarRange className="h-8 w-8 text-emerald-500" />
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-border/60">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground">Concluidos</p>
              <p className="mt-1 text-3xl font-semibold">{stats.completed}</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-border/60">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground">Cancelados</p>
              <p className="mt-1 text-3xl font-semibold">{stats.canceled}</p>
            </div>
            <XCircle className="h-8 w-8 text-rose-500" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="calendar-surface rounded-[30px] border-border/60">
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-2xl">Agenda visual</CardTitle>
                <CardDescription className="mt-2">
                  Arraste para reagendar, clique para editar e use a busca para
                  focar no que importa.
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-3 md:justify-end">
                <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-muted/30 px-3 py-2 text-sm">
                  <CalendarRange className="h-4 w-4 text-muted-foreground" />
                  <span>{currentTitle || formatRangeLabel(range.startMs, range.endMs)}</span>
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-muted/30 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Fim de semana</span>
                  <Switch checked={showWeekends} onCheckedChange={setShowWeekends} />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {(["scheduled", "completed", "canceled"] as CalendarEvent["status"][]).map(
                  (status) => {
                    const enabled = statusFilter.includes(status);
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() =>
                          setStatusFilter((current) =>
                            current.includes(status)
                              ? current.filter((item) => item !== status)
                              : [...current, status],
                          )
                        }
                        className={`rounded-full border px-3 py-1.5 text-sm transition ${
                          enabled
                            ? "cursor-pointer border-primary/30 bg-primary/10 text-primary"
                            : "cursor-pointer border-border/60 bg-card text-muted-foreground"
                        }`}
                      >
                        {STATUS_LABELS[status]}
                      </button>
                    );
                  },
                )}
              </div>

              <div className="w-full md:w-80">
                <div className="w-full">
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Buscar por titulo, local ou observacao"
                    icon={<Search className="h-4 w-4" />}
                  />
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCalendarNavigation("today")}
                  >
                    Hoje
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => handleCalendarNavigation("prev")}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => handleCalendarNavigation("next")}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <Tabs value={currentView} onValueChange={handleCalendarViewChange}>
                  <TabsList className="rounded-2xl bg-muted/40 p-1">
                    <TabsTrigger value="dayGridMonth">Mes</TabsTrigger>
                    <TabsTrigger value="timeGridWeek">Semana</TabsTrigger>
                    <TabsTrigger value="timeGridDay">Dia</TabsTrigger>
                    <TabsTrigger value="listWeek">Lista</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {isLoadingEvents ? (
                <div className="text-sm text-muted-foreground">
                  Atualizando compromissos...
                </div>
              ) : null}
            </div>

            <div className="relative">
              <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
                locale={ptBrLocale}
                initialView="dayGridMonth"
                height="auto"
                contentHeight={720}
                editable={canEdit}
                selectable={canCreate}
                selectMirror
                weekends={showWeekends}
                events={calendarEvents}
                eventContent={renderEventContent}
                datesSet={(arg: DatesSetArg) => {
                  setCurrentView(arg.view.type as CalendarViewType);
                  setCurrentTitle(arg.view.title);
                  setRange({
                    startMs: arg.start.getTime() - 14 * 24 * 60 * 60 * 1000,
                    endMs: arg.end.getTime() + 45 * 24 * 60 * 60 * 1000,
                  });
                }}
                headerToolbar={false}
                buttonText={{
                  today: "Hoje",
                  month: "Mes",
                  week: "Semana",
                  day: "Dia",
                  list: "Lista",
                }}
                dayMaxEvents={3}
                slotMinTime="06:00:00"
                slotMaxTime="22:00:00"
                nowIndicator
                select={(selection) => handleOpenCreateDialog(selection)}
                eventClick={(arg: EventClickArg) => {
                  const event = events.find((item) => item.id === arg.event.id);
                  if (event) {
                    handleOpenEditDialog(event);
                  }
                }}
                eventDrop={handleEventMove}
                eventResize={handleEventMove}
              />

              {isLoadingEvents ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[28px] bg-background/70 backdrop-blur-[1px]">
                  <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/90 px-4 py-3 text-sm text-muted-foreground shadow-sm">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Carregando compromissos...
                  </div>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[30px] border-border/60">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">Google Agenda da empresa</CardTitle>
                  <CardDescription className="mt-2">
                    A agenda compartilhada do time pode sincronizar com o Google e
                    refletir automaticamente nas alteracoes feitas fora do ERP.
                  </CardDescription>
                </div>
                {isLoadingGoogle ? (
                  <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : googleStatus.connected ? (
                  <Badge variant="success">Conectado</Badge>
                ) : (
                  <Badge variant="outline">Desconectado</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {googleStatus.connected ? (
                <>
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                    <p className="text-sm font-medium text-foreground">
                      Agenda compartilhada conectada
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {googleStatus.email || "Conta principal da empresa conectada"}
                    </p>
                    {googleStatus.lastSuccessfulSyncAt ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Ultimo sync: {formatDateTime(googleStatus.lastSuccessfulSyncAt)}
                      </p>
                    ) : null}
                  </div>

                  {googleStatus.lastSyncError ? (
                    <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                      Ultimo erro: {googleStatus.lastSyncError}
                    </div>
                  ) : null}

                  {canManageCompanyCalendar ? (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={handleGoogleConnect}
                        disabled={isConnectingGoogle}
                      >
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Reconectar
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={handleGoogleDisconnect}
                        disabled={isLoadingGoogle}
                      >
                        <Unlink2 className="mr-2 h-4 w-4" />
                        Desconectar
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-border/60 bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
                      A conexao da agenda da empresa e administrada por um usuario master.
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="rounded-2xl border border-border/60 bg-muted/25 px-4 py-4">
                    <div className="flex items-start gap-3">
                      <CloudOff className="mt-0.5 h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">
                          Conecte a agenda principal da empresa
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Quando a empresa conecta uma agenda central do Google, os
                          compromissos passam a sincronizar em uma fonte compartilhada
                          para o time inteiro.
                        </p>
                      </div>
                    </div>
                  </div>
                  {canManageCompanyCalendar ? (
                    <Button
                      className="w-full"
                      onClick={handleGoogleConnect}
                      disabled={isConnectingGoogle}
                    >
                      {isConnectingGoogle ? (
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Link2 className="mr-2 h-4 w-4" />
                      )}
                      Conectar agora
                    </Button>
                  ) : (
                    <div className="rounded-2xl border border-border/60 bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
                      Peca para um usuario master conectar a agenda da empresa.
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[30px] border-border/60">
            <CardHeader>
              <CardTitle className="text-xl">Proximos compromissos</CardTitle>
              <CardDescription className="mt-2">
                Lista viva baseada na visualizacao e nos filtros ativos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingEvents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                  Nenhum compromisso visivel neste recorte.
                </div>
              ) : (
                upcomingEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => handleOpenEditDialog(event)}
                    className="group w-full rounded-2xl border border-border/60 bg-card px-4 py-4 text-left transition hover:border-primary/30 hover:bg-primary/[0.03]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: event.color }}
                          />
                          <p className="truncate font-medium">{event.title}</p>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            {event.isAllDay
                              ? formatDateOnly(event.startDate || event.createdAt)
                              : formatDateTime(event.startsAt || event.createdAt)}
                          </span>
                          {event.location ? (
                            <span className="truncate rounded-full bg-muted px-2 py-1">
                              {event.location}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={STATUS_BADGES[event.status]}>
                          {STATUS_LABELS[event.status]}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <CalendarEventDialog
        open={dialogOpen}
        mode={dialogMode}
        values={formValues}
        event={activeEvent}
        canEdit={dialogMode === "create" ? canCreate : canEdit}
        isSubmitting={isSubmitting}
        isDeleting={isDeleting}
        onOpenChange={setDialogOpen}
        onChange={(field, value) =>
          setFormValues((current) => ({
            ...current,
            [field]: value,
          }))
        }
        onSubmit={handleSubmitEvent}
        onDelete={handleDeleteEvent}
      />
    </div>
  );
}
