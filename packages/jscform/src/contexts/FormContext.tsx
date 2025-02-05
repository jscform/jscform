import React, {createContext, useContext, useRef} from "react";
import {UseBoundStore, useStore} from "zustand/react";
import {JSONSchema} from "../utils/types";
import {createFormStore, FormStore} from "../store/createFormStore";
import get from "lodash/get";
import type {StoreApi} from "zustand/vanilla";

export const FormContext = createContext<UseBoundStore<StoreApi<FormStore>> | undefined>(undefined);

export interface FormProviderProps {
    schema: JSONSchema;
    data: Record<string, any>;
    context?: Record<string, any>;
    children: React.ReactNode;
}

export function FormProvider({schema, data, context, children}: FormProviderProps) {
    const form = useRef(createFormStore({schema, data, context})).current;
    return <FormContext.Provider value={form}>{children}</FormContext.Provider>
}

export const useForm = (schemaKey: string) => {
    const formStore = useContext(FormContext);
    if(!formStore) {
        throw Error("useForm must be used within a FormProvider");
    }
    return {
        schema: useStore(formStore, (state) =>  get(state.schema, schemaKey) as JSONSchema), // FIXME: to get schema based on schema key
        data: useStore(formStore, (state) => get(state.data, schemaKey)),
        context: useStore(formStore, (s) => s.context),
        validator: useStore(formStore, (s) => s.validator),
    };
}

