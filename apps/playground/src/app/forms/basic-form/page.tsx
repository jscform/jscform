"use client";
import {Form, JSONSchema, createRegistry} from "@repo/jscform";
import testSchema from "./test.json";
import InputText from "../../../components/InputText";

createRegistry({
    InputText,
});

export default function BasicForm() {
    const onSubmit = (data: Record<string, any>) => {
        console.log(data);
    };

    return (
        <div>
            <h1 className="text-2xl font-bold mb-4">Basic Form</h1>
            <div>
                <Form schema={testSchema as JSONSchema} onSubmit={onSubmit} data={{}}></Form>
            </div>
        </div>
    )
}
