import TimeTrackingWidget from "./widgets/TimeTrackingWidget";
import LeaveBalanceWidget from "./widgets/LeaveBalanceWidget";
import NotificationsWidget from "./widgets/NotificationsWidget";
import WeeklyHoursWidget from "./widgets/WeeklyHoursWidget";
import TeamAvailabilityWidget from "./widgets/TeamAvailabilityWidget";
import CalendarWidget from "./widgets/CalendarWidget";

export const widgetRegistry = {
  time_tracking: TimeTrackingWidget,
  leave_balance: LeaveBalanceWidget,
  notifications: NotificationsWidget,
  weekly_hours: WeeklyHoursWidget,
  availability: TeamAvailabilityWidget,
  calendar: CalendarWidget,
};