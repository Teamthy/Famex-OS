import ITCourseTrackPage from "@/components/it/ITCourseTrackPage";
import { IT_COURSES } from "@/content/it-courses";

export default function Page() {
  return <ITCourseTrackPage course={IT_COURSES["python"]} />;
}
