import { define, object } from "@react-form-builder/core";
import ActualChemAccordion from "../components/shared/ActualChemAccordion";

export const actualChemAccordion = define(ActualChemAccordion, "ActualChemAccordion")
  .name("Actual Chem Accordion")
  .category("layout")
  .props({
    spectroData: object,
    formRef: object,
    actualChemistry: object,
  });
