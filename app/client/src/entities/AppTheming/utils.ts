import { get, has } from "lodash";
import {
  combineDynamicBindings,
  getDynamicBindings,
} from "utils/DynamicBindingUtils";
import {
  FieldThemeStylesheet,
  ROOT_SCHEMA_KEY,
} from "widgets/JSONFormWidget/constants";
import { parseSchemaItem } from "widgets/WidgetUtils";
import { getFieldStylesheet } from "widgets/JSONFormWidget/helper";
import { CanvasWidgetsReduxState } from "reducers/entityReducers/canvasWidgetsReducer";
import { AppTheme } from "entities/AppTheming";
import {
  batchUpdateMultipleWidgetProperties,
  UpdateWidgetPropertyPayload,
} from "actions/controlActions";

/**
 * get properties to update for reset
 */
export const getPropertiesToUpdateForReset = (
  canvasWidgets: CanvasWidgetsReduxState,
  themeStylesheet: AppTheme["stylesheet"],
) => {
  const propertiesToUpdate: UpdateWidgetPropertyPayload[] = [];

  const propertiesToIgnore = [
    "childStylesheet",
    "submitButtonStyles",
    "resetButtonStyles",
  ];

  Object.keys(canvasWidgets).map((widgetId) => {
    const widget = canvasWidgets[widgetId];
    const stylesheetValue = themeStylesheet[widget.type];
    const modifications: any = {};

    if (stylesheetValue) {
      Object.keys(stylesheetValue).map((propertyKey) => {
        if (
          stylesheetValue[propertyKey] !== widget[propertyKey] &&
          propertiesToIgnore.includes(propertyKey) === false
        ) {
          modifications[propertyKey] = stylesheetValue[propertyKey];
        }
      });

      if (widget.type === "TABLE_WIDGET") {
        Object.keys(widget.primaryColumns).map((primaryColumnKey) => {
          const primaryColumn = widget.primaryColumns[primaryColumnKey];
          const childStylesheetValue =
            widget.childStylesheet[primaryColumn.columnType];

          if (childStylesheetValue) {
            Object.keys(childStylesheetValue).map((childPropertyKey) => {
              const { jsSnippets, stringSegments } = getDynamicBindings(
                childStylesheetValue[childPropertyKey],
              );

              const js = combineDynamicBindings(jsSnippets, stringSegments);
              const computedValue = `{{${widget.widgetName}.sanitizedTableData.map((currentRow) => ( ${js}))}}`;

              if (computedValue !== primaryColumn[childPropertyKey]) {
                modifications[
                  `primaryColumns.${primaryColumnKey}.${childPropertyKey}`
                ] = computedValue;
              }
            });
          }
        });
      }

      if (widget.type === "BUTTON_GROUP_WIDGET") {
        Object.keys(widget.groupButtons).map((groupButtonName: string) => {
          const groupButton = widget.groupButtons[groupButtonName];

          const childStylesheetValue = stylesheetValue.childStylesheet.button;

          Object.keys(childStylesheetValue).map((childPropertyKey) => {
            if (
              childStylesheetValue[childPropertyKey] !==
              groupButton[childPropertyKey]
            ) {
              modifications[
                `groupButtons.${groupButtonName}.${childPropertyKey}`
              ] = childStylesheetValue[childPropertyKey];
            }
          });
        });
      }

      if (widget.type === "JSON_FORM_WIDGET") {
        if (has(widget, "schema")) {
          parseSchemaItem(
            widget.schema[ROOT_SCHEMA_KEY],
            `schema.${ROOT_SCHEMA_KEY}`,
            (schemaItem, propertyPath) => {
              const fieldStylesheet = getFieldStylesheet(
                schemaItem.fieldType,
                themeStylesheet[widget.type].childStylesheet as any,
              );

              Object.keys(fieldStylesheet).map((fieldPropertyKey) => {
                const fieldStylesheetValue = fieldStylesheet[fieldPropertyKey];

                if (
                  fieldStylesheetValue !== get(schemaItem, fieldPropertyKey)
                ) {
                  modifications[
                    `${[propertyPath]}.${fieldPropertyKey}`
                  ] = fieldStylesheetValue;
                }
              });
            },
          );
        }

        // reset submit button
        ["submitButtonStyles", "resetButtonStyles"].map((buttonStyleKey) => {
          Object.keys(stylesheetValue[buttonStyleKey]).map((propertyKey) => {
            const buttonStylesheetValue =
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              stylesheetValue[buttonStyleKey][propertyKey];

            if (buttonStylesheetValue !== widget[buttonStyleKey][propertyKey]) {
              modifications[
                `${buttonStyleKey}.${propertyKey}`
              ] = buttonStylesheetValue;
            }
          });
        });
      }

      if (Object.keys(modifications).length > 0) {
        propertiesToUpdate.push({
          widgetId,
          updates: {
            modify: modifications,
          },
        });
      }
    }
  });

  return propertiesToUpdate;
};
