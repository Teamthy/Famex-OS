/**
 * Ykay College — design system barrel.
 *
 * Lets screens import from a single place:
 *   import { Card, Button, StatCard, ProgressRing } from "@/src/components";
 *
 * Existing deep imports (@/src/components/cards, …) keep working — nothing
 * needs to be rewritten to adopt this.
 */

export { FadeIn, Stagger } from "./animation";
export { Avatar } from "./avatar";
export type { AvatarProps } from "./avatar";
export { Badge } from "./badges";
export type { BadgeProps } from "./badges";
export { Button } from "./buttons";
export type { ButtonProps } from "./buttons";
export { Card } from "./cards";
export type { CardProps } from "./cards";
export { BackgroundCarousel } from "./carousel";
export {
  greetingFor,
  DashboardGreeting,
  Metric,
  MetricGrid,
  ActionRow,
  SectionHeading,
  ChildSwitcher,
  InlineError,
} from "./dashboard";
export type { MetricProps, ChildOption, QuickAction } from "./dashboard";
export { QuickActions } from "./dashboard";
export { Chip, ChipRow, SegmentedControl } from "./chips";
export type { ChipProps, SegmentedControlProps } from "./chips";
export { EmptyState, Loading, ErrorState, Skeleton } from "./feedback";
export { Input, TextArea } from "./inputs";
export type { InputProps } from "./inputs";
export { Screen, AppBar, Container, Section, Row, Column, Spacer, Divider } from "./layout";
export { ListItem } from "./lists";
export type { ListItemProps } from "./lists";
export { Modal } from "./modals";
export type { ModalProps } from "./modals";
export { AppHeader } from "./navigation";
export type { AppHeaderProps } from "./navigation";
export { NotificationRow } from "./notifications";
export type { NotificationRowProps, NotificationTone } from "./notifications";
export { ProgressBar, ProgressRing } from "./progress";
export type { ProgressBarProps, ProgressRingProps } from "./progress";
export { StatCard, StatGrid } from "./stats";
export type { StatCardProps } from "./stats";
export { H1, H2, H3, Body, Caption, Label } from "./typography";
