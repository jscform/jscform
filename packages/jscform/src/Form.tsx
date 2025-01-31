"use client";

import React from "react";
import {FormProvider} from "./FormContext";
import {FormEvent} from "react";

export interface FormProps {
    schema: Record<string, any>;
    data?: Record<string, any>;
    ctx?: Record<string, any>;
    onSubmit?: (data: Record<string, any>) => void;
    onError?: (data: Record<string, any>) => void;
    onChange?: (data: Record<string, any>) => void;
}

export function Form({schema, data = {}, ctx, onSubmit}: FormProps) {

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        // const formData = new FormData(event.target as HTMLFormElement);
        onSubmit?.(data);
        return false;
    }

    return (
        <FormProvider data={data} schema={schema} ctx={ctx || {}}>
            <form onSubmit={handleSubmit}>
                This is form!
            </form>
        </FormProvider>
    );
}
