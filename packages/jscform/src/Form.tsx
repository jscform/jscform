import {FormProvider} from "./formContext";
import {FormEvent} from "react";

export interface FormProps {
    data: Record<string, any>;
    schema: Record<string, any>;
    ctx: Record<string, any>;
    onSubmit?: (data: Record<string, any>) => void;
}

export default function Form({data, schema, ctx, onSubmit}: FormProps) {

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        const formData = new FormData(event.target as HTMLFormElement);
        onSubmit?.(data);
        return false;
    }

    return (
        <FormProvider data={data} schema={schema} ctx={ctx}>
            <form onSubmit={handleSubmit}>
                {}
            </form>
        </FormProvider>
    );
}
