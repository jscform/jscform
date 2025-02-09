import React from "react";
import {JSONSchema} from "./utils/types";
import {FormProvider} from "./contexts/FormContext";
import type {Ajv} from "ajv";
import {DynamicUIComponent} from "./components/DynamicUIComponent";

export interface FormProps {
    schema: JSONSchema;
    data: Record<string, any>;
    context?: Record<string, any>;
    onSubmit: (data: Record<string, any>) => void;
    validator?: Ajv;
}

export function Form({schema, data, context, validator}: FormProps) {
    // const onRender = (id: string, phase: string, actualDuration: number) => {
    //     console.log({id, phase, actualDuration})
    // }
    return <FormProvider data={data} schema={schema} context={context} validator={validator}>
        {/*<Profiler id={"DynamicComponent"} onRender={onRender}>*/}
            <DynamicUIComponent/>
        {/*</Profiler>*/}
    </FormProvider>
}
