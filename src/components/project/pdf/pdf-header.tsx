import { View, Text } from "@react-pdf/renderer";
import { styles } from "./pdf-styles";
import type { Project, Mixer } from "@/types/convex";

interface PDFHeaderProps {
  project: Project;
  mixer?: Mixer;
}

export function PDFHeader({ project, mixer }: PDFHeaderProps) {
  const dateFormatted = project.date
    ? new Date(project.date).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>{project.title}</Text>
      <View style={styles.headerMeta}>
        <View>
          {dateFormatted && (
            <Text style={styles.headerSubtitle}>{dateFormatted}</Text>
          )}
          {project.venue && (
            <Text style={styles.headerSubtitle}>{project.venue}</Text>
          )}
        </View>
        {mixer && (
          <View>
            <Text style={styles.headerSubtitle}>
              {mixer.name} ({mixer.channelCount}ch)
            </Text>
            {mixer.type && (
              <Text style={styles.headerSubtitle}>{mixer.type}</Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}
