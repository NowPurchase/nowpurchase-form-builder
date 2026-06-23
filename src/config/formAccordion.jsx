import { define, string, boolean, node, object } from "@react-form-builder/core";
import FormAccordion from "../components/shared/FormAccordion";

export const formAccordion = define(FormAccordion, "FormAccordion")
  .name("Accordion")
  .category("layout")
  .props({
    header: string.default("Section"),
    defaultOpen: boolean.default(true),
    panelColor: string.default("#F2F2F2"),
    panelPadding: string,
    labelColor: string,
    labelSize: string,
    labelTracking: string,
    headerPadding: string,
    headerBackground: string,
    headerBorderBottom: string,
    children: node,
    spectroData: object,
    formRef: object,
    actualChemistry: object,
  });
