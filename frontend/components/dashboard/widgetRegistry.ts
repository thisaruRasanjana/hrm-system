import TimeTrackingWidget from "./widgets/TimeTrackingWidget";
import LeaveBalanceWidget from "./widgets/LeaveBalanceWidget";
import NotificationsWidget from "./widgets/NotificationsWidget";
import WeeklyHoursWidget from "./widgets/WeeklyHoursWidget";
import TeamAvailabilityWidget from "./widgets/TeamAvailabilityWidget";
import CalendarWidget from "./widgets/CalendarWidget";
import ApprovalSummaryWidget from "./widgets/ApprovalSummaryWidget";
import AnnouncementsWidget from "./widgets/AnnouncementsWidget";
import UpcomingEventsWidget from "./widgets/UpcomingEventsWidget";

export const widgetRegistry: any = {
  time_tracking: TimeTrackingWidget,
  leave_balance: LeaveBalanceWidget,
  notifications: NotificationsWidget,
  weekly_hours: WeeklyHoursWidget,
  availability: TeamAvailabilityWidget,
  calendar: CalendarWidget,
  approval_summary: ApprovalSummaryWidget,
  announcements: AnnouncementsWidget,
  upcoming_events: UpcomingEventsWidget
};