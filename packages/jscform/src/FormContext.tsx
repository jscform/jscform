"use client";
import React from "react";
import {createContext, useContext} from "react";

export interface FormContextType {
    data: Record<string, any>;
    schema: Record<string, any>;
    ctx: Record<string, any>;
    options?: Record<string, any>;
}

export const FormContext = createContext<FormContextType | null>(null);

export const useForm = () => useContext(FormContext);


export interface FormProviderProps extends FormContextType {
    children: React.ReactNode;
}

export function FormProvider({data, schema, ctx, children}: FormProviderProps) {
    return (<FormContext.Provider value={{data, schema, ctx}}>
        {children}
    </FormContext.Provider>)
}


