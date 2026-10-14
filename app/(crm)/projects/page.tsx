import { ProjectsModule } from "@/components/projects";
import { MOCK_PROJECTS } from "@/src/mock/data";

export default function ProjectsPage() {
  return <ProjectsModule initialProjects={MOCK_PROJECTS} companies={[]} />;
}
