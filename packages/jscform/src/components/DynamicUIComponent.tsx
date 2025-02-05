import React, {ReactElement, useState} from "react";
import {JSONSchema} from "../utils/types";
import useDeepCompareEffect from "use-deep-compare-effect";
import retrieveSchema from "../utils/retrieveSchema";
import {PROPERTIES_KEY, UI_WIDGET} from "../utils/constants";
import {useForm} from "../contexts/FormContext";
import {globalRegistry} from "../createRegistry";

interface DynamicUIomponentProps {
    schema: JSONSchema;
    schemaKey?: string;
    children?: ReactElement;
}

export default function DynamicUIComponent({schema, schemaKey = ""}: DynamicUIomponentProps) {
    const [currentSchema, setCurrentSchema] = useState<JSONSchema>(schema);
    const form = useForm(schemaKey);
    useDeepCompareEffect(() => {
        (async () => {
            if (form.validator && schema) {
                setCurrentSchema(await retrieveSchema(form.validator, schema, form.schema, form.data));
            }
        })();
    }, [schema, form.data, form.schema, form.validator]);
    if (!currentSchema) {
        return null;
    }
    if (!currentSchema[UI_WIDGET]) {
        throw Error(`${UI_WIDGET} property missing for "${schemaKey}"`);
    }
    if (!currentSchema[PROPERTIES_KEY]) {
        const Widget = globalRegistry[currentSchema[UI_WIDGET]];
        if (!Widget) {
            throw Error(`Widget "${currentSchema[UI_WIDGET]}" not found in registry`);
        }
        return <Widget schema={currentSchema} schemaKey={schemaKey}/>
    }
    const {widget} = currentSchema[PROPERTIES_KEY];
    const ContainerComponent = globalRegistry[widget] || React.Fragment;
    const childComponents = []
    for (const property of Object.keys(currentSchema[PROPERTIES_KEY])) {
        childComponents.push(<DynamicUIComponent
            schema={currentSchema[PROPERTIES_KEY][property]}
            schemaKey={`${schemaKey ? schemaKey + "." : ""}${property}`}
            key={`${schemaKey ? schemaKey + "." : ""}${property}`}
        />)
    }
    return (<ContainerComponent>{childComponents}</ContainerComponent>)
}
