import React from "react";
import {JSONSchema} from "./utils/types";
import {FormProvider} from "./contexts/FormContext";
import DynamicUIComponent from "./components/DynamicUIComponent";

export interface FormProps {
    schema: JSONSchema;
    data: Record<string, any>;
    context?: Record<string, any>;
    onSubmit: (data: Record<string, any>) => void;
}

export function Form({ schema, data, context }: FormProps) {
    return <FormProvider data={data} schema={schema} context={context}>
        <DynamicUIComponent schema={schema} key={""} schemaKey={""} />
    </FormProvider>
}
