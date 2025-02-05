"use client";
import React from "react";
import {createContext, useContext} from "react";

export interface FormContextType {
    data: Record<string, any>;
    schema: Record<string, any>;
    _ctx: Record<string, any>;
}

export const FormContext = createContext<FormContextType | null>(null);

export const useForm = () => useContext(FormContext);


export interface FormProviderProps extends FormContextType {
    children: React.ReactNode;
}

export function FormProvider({data, schema, _ctx, children}: FormProviderProps) {
    // TODO: Do we need to have local state here?
    return (<FormContext.Provider value={{data, schema, _ctx}}>
        {children}
    </FormContext.Provider>)
}


