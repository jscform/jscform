import React, { ReactElement, useState } from "react";
import { JSONSchema } from "../utils/types";
import { useValidator } from "../ValidatorContext";
import useDeepCompareEffect from "use-deep-compare-effect";
import retrieveSchema from "../utils/retrieveSchema";
import { X_UICOMPONENT } from "../utils/constants";


interface DynamicUIomponentProps {
    schema: JSONSchema;
    rootSchema: JSONSchema;
    schemaKey?: string;
    children?: ReactElement;
    data?: any
}

export default function DynamicUIComponent({ schema, rootSchema, schemaKey = "", data }: DynamicUIomponentProps) {
    const [currentSchema, setCurrentSchema] = useState<JSONSchema>();
    const validator = useValidator();

    useDeepCompareEffect(() => {
        (async () => {
            if (validator && schema) {
                const newSchema = await retrieveSchema(validator, schema, rootSchema, data);
                setCurrentSchema(newSchema);
            }
        })();
    }, [data, schema, rootSchema, validator]);

    if (!currentSchema) {
        return null;
    }

    if (!currentSchema[X_UICOMPONENT]) {
        throw Error(`${X_UICOMPONENT} property missing for "${schemaKey}"`);
    }

    return (<div>ok</div>)
}