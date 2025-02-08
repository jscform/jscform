"use client";
import {Form, JSONSchema, createRegistry} from "@repo/jscform";
import testSchema from "./test.json";
import {Input} from "@/components/ui/input.tsx";
import {Col1Layout} from "@/components/ui/col1Layout.tsx";
import {Col2Layout} from "@/components/ui/col2Layout.tsx";
import {Col3Layout} from "@/components/ui/col3Layout.tsx";
import {Checkbox} from "@/components/ui/checkbox.tsx";

createRegistry({
    Input,
    Checkbox,
    Col1Layout,
    Col2Layout,
    Col3Layout,
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
