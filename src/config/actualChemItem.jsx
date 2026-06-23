import { define, string, boolean, object } from "@react-form-builder/core";
import ActualChemItem from "../components/shared/ActualChemItem";

export const actualChemItem = define(ActualChemItem, "ActualChemItem")
  .name("Actual Chemistry")
  .category("layout")
  .props({
    header: string.default("Actual Chemistry"),
    defaultOpen: boolean.default(true),
    panelColor: string.default("transparent"),
    headerPadding: string,
    spectroData: object,
    formRef: object,
    actualChemistry: object,
  });
