import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const sizeSmSelector = {
  selector: "JSXAttribute[name.name='size'][value.value='sm']",
  message: "Removed size. Every control is 44px (h-control). Use the default size, or size=\"icon\" for icon-only buttons.",
};

const subControlHeightSelector = {
  selector: "JSXOpeningElement[name.name=/^(Button|Input|Textarea|SelectTrigger|SelectItem|TabsList|TabsTrigger|CommandInput|CommandItem|DropdownMenuItem|DropdownMenuTrigger)$/] JSXAttribute[name.name='className'] Literal[value=/(^|\\s)(h|min-h|size)-(3|3\\.5|4|5|6|7|8|9|10)(\\s|$)/]",
  message: "Sub-44px height override on a control. Controls are h-control / min-h-control / size-control (44px). Do not shrink them at the call site.",
};

const rawElementInAdminSelector = {
  selector: "JSXOpeningElement[name.name=/^(button|input|select|textarea)$/]",
  message: "Use the ui-kit primitive (Button, Input, Select, Textarea), not a raw element. Raw elements bypass the 44px control height.",
};

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"]
}, {
  files: ["src/**/*.tsx"],
  rules: {
    "no-restricted-syntax": ["error", sizeSmSelector, subControlHeightSelector],
  },
}, {
  files: ["src/app/admin/**/*.tsx", "src/app/components/features/admin/**/*.tsx"],
  rules: {
    "no-restricted-syntax": ["error", sizeSmSelector, subControlHeightSelector, rawElementInAdminSelector],
  },
}];

export default eslintConfig;
