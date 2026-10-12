import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import { SettingsSection } from "@/components/settings-section";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/hooks/use-settings";
import {
  moveHomeSection,
  resolveHomeSections,
  setHomeSectionVisible,
} from "@/lib/home-sections";

export const Route = createFileRoute("/settings/home")({
  component: HomeSettingsPage,
});

function HomeSettingsPage() {
  const { t } = useTranslation("settings", { keyPrefix: "home" });
  const { settings, update } = useSettings();
  const sections = resolveHomeSections(settings.homeSections);

  return (
    <>
      <SettingsSection title={t("enabled")}>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.homeEnabled}
            onChange={(event) => update("homeEnabled", event.target.checked)}
          />
          {t("enabledLabel")}
        </label>
        <p className="text-xs text-muted-foreground">{t("enabledHint")}</p>
      </SettingsSection>

      <SettingsSection title={t("sectionsTitle")}>
        <p className="text-xs text-muted-foreground">{t("sectionsHint")}</p>
        <ul className="flex w-fit min-w-72 flex-col divide-y rounded-md border">
          {sections.map((section, index) => (
            <li key={section.id} className="flex items-center gap-2 p-2">
              <label className="flex flex-1 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={section.visible}
                  onChange={(event) =>
                    update(
                      "homeSections",
                      setHomeSectionVisible(
                        settings.homeSections,
                        section.id,
                        event.target.checked,
                      ),
                    )
                  }
                />
                {t(`sections.${section.id}`)}
              </label>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={index === 0}
                onClick={() =>
                  update(
                    "homeSections",
                    moveHomeSection(settings.homeSections, index, -1),
                  )
                }
                title={t("moveUp")}
                aria-label={t("moveUpNamed", {
                  name: t(`sections.${section.id}`),
                })}
              >
                <ArrowUp />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={index === sections.length - 1}
                onClick={() =>
                  update(
                    "homeSections",
                    moveHomeSection(settings.homeSections, index, 1),
                  )
                }
                title={t("moveDown")}
                aria-label={t("moveDownNamed", {
                  name: t(`sections.${section.id}`),
                })}
              >
                <ArrowDown />
              </Button>
            </li>
          ))}
        </ul>
      </SettingsSection>
    </>
  );
}
