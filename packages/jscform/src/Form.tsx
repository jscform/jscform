"use client";

import React, { FormEvent } from "react";
import { FormProvider } from "./FormContext";
import DynamicUIComponent from "./components/DynamicUIComponent";

export interface FormProps {
    schema: Record<string, any>;
    data?: Record<string, any>;
    ctx?: Record<string, any>;
    onSubmit?: (data: Record<string, any>) => void;
    onError?: (data: Record<string, any>) => void;
    onChange?: (data: Record<string, any>) => void;
}

export function Form({ schema, data = {}, ctx, onSubmit }: FormProps) {

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        // const formData = new FormData(event.target as HTMLFormElement);
        onSubmit?.(data);
        return false;
    }

    return (
        <FormProvider data={data} schema={schema} _ctx={ctx || {}}>
            <form onSubmit={handleSubmit}>
                <DynamicUIComponent data={data} />
            </form>
        </FormProvider>
    );
}