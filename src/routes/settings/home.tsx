import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import { SettingsSection } from "@/components/settings-section";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/hooks/use-settings";
import {
  HOME_SECTION_LAYOUTS,
  HOME_SECTION_MAX_COUNT,
  HOME_SECTION_MIN_COUNT,
} from "@/shared/settings";
import {
  clampHomeCount,
  moveHomeSection,
  resolveHomeSections,
  setHomeSectionOptions,
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
        <p className="text-xs text-muted-foreground">{t("countHint")}</p>
        <ul className="flex w-fit min-w-72 max-w-full flex-col divide-y rounded-md border">
          {sections.map((section, index) => (
            <li
              key={section.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 p-2"
            >
              <label className="flex min-w-60 flex-1 items-center gap-2 text-sm">
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
              <label className="flex items-center gap-2 text-sm">
                {t("count")}
                <input
                  type="number"
                  className="h-8 w-16 rounded-md border bg-background px-2"
                  min={HOME_SECTION_MIN_COUNT}
                  max={HOME_SECTION_MAX_COUNT}
                  step={1}
                  value={section.count}
                  aria-label={t("countNamed", {
                    name: t(`sections.${section.id}`),
                  })}
                  onChange={(event) => {
                    const count = event.target.valueAsNumber;
                    if (Number.isNaN(count)) return;
                    update(
                      "homeSections",
                      setHomeSectionOptions(settings.homeSections, section.id, {
                        count: clampHomeCount(count),
                      }),
                    );
                  }}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                {t("layout")}
                <select
                  className="h-8 rounded-md border bg-background px-2"
                  value={section.layout}
                  aria-label={t("layoutNamed", {
                    name: t(`sections.${section.id}`),
                  })}
                  onChange={(event) =>
                    update(
                      "homeSections",
                      setHomeSectionOptions(settings.homeSections, section.id, {
                        layout: event.target
                          .value as (typeof HOME_SECTION_LAYOUTS)[number],
                      }),
                    )
                  }
                >
                  {HOME_SECTION_LAYOUTS.map((layout) => (
                    <option key={layout} value={layout}>
                      {t(`layouts.${layout}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={section.hideWhenEmpty}
                  onChange={(event) =>
                    update(
                      "homeSections",
                      setHomeSectionOptions(settings.homeSections, section.id, {
                        hideWhenEmpty: event.target.checked,
                      }),
                    )
                  }
                />
                {t("hideWhenEmpty")}
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
