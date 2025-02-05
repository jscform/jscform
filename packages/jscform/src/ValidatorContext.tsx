"use client";
import React from "react";
import Ajv from "ajv";
import { createContext, useContext } from "react";

export interface ValidatorContextType extends Ajv {
}
const ajv = new Ajv({
    $data: true,
    useDefaults: true,
    strict: false,
    allErrors: true
})

export const ValidatorContext = createContext<ValidatorContextType>(ajv);

export const useValidator = () => useContext(ValidatorContext);

export interface ValidatorProviderProps {
    validator: ValidatorContextType
    children: React.ReactNode;
}

export function ValidatorProvider({ validator, children }: ValidatorProviderProps) {
    return (<ValidatorContext.Provider value={validator || ajv}>
        {children}
    </ValidatorContext.Provider>);
}