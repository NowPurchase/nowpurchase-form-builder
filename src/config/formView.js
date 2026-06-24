// ---------------------------------------------------------------------------
// formView.js — the single FormEngine viewer registration shared by the form
// renderer (ViewForm) and the standalone live-preview page (FormPreview), so a
// preview always matches production.
//
// Registers the upstream rsuite components (minus the overridden RsDropdown)
// + the table components + every NowPurchase custom component
// (RsSpectrometerReading, RsCameraCapture, RsChipInput, RsDropdown).
// ---------------------------------------------------------------------------
import {
  formEngineRsuiteCssLoader,
  ltrCssLoader,
  RsLocalizationWrapper,
  rSuiteComponents,
} from '@react-form-builder/components-rsuite';
import { rSuiteTableComponents } from '@react-form-builder/components-rsuite-table';
import { BiDi, createView } from '@react-form-builder/core';
import { rsChipInput, rsSpectrometerReading } from 'np-dlms-components';
import { rsDropdownOverride } from './rsDropdownOverride';
import { rsTagPickerOverride } from './rsTagPickerOverride';
import { rsCameraCaptureOverride } from './rsCameraCaptureOverride';

const customComponents = [
  rsSpectrometerReading,
  rsCameraCaptureOverride,
  rsChipInput,
  rsDropdownOverride,
  rsTagPickerOverride,
];

// Drop the stock RsDropdown + RsTagPicker — both are replaced by overrides that
// support async master-data loading (the stock TagPicker strips onLoadData).
const OVERRIDDEN = new Set(['RsDropdown', 'RsTagPicker']);
const components = [
  ...rSuiteComponents.filter((c) => !OVERRIDDEN.has(c.build().model.type)),
  ...rSuiteTableComponents,
  ...customComponents,
].map((c) => c.build().model);

export const viewWithCss = createView(components)
  .withViewerWrapper(RsLocalizationWrapper)
  .withCssLoader(BiDi.LTR, ltrCssLoader)
  .withCssLoader('common', formEngineRsuiteCssLoader);
