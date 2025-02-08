import React, {memo, ReactElement} from "react";
import {PROPERTIES_KEY, UI_WIDGET} from "../utils/constants";
import {globalRegistry} from "../createRegistry";
import {useSchema} from "../hooks/useSchema";

interface DynamicUIComponentProps {
    schemaKey?: string;
    children?: ReactElement;
}

export const DynamicUIComponent = memo(({schemaKey = ""}: DynamicUIComponentProps) => {
    const schema = useSchema(schemaKey);
    if (!schema) {
        return null;
    }
    if (!schema[UI_WIDGET]) {
        throw Error(`${UI_WIDGET} property missing for "${schemaKey}"`);
    }
    const uiWidget = schema[UI_WIDGET];

    if (!schema[PROPERTIES_KEY]) {
        const Widget = globalRegistry[uiWidget.widget];
        if (!Widget) {
            throw Error(`Widget "${uiWidget.widget}" not found in registry`);
        }
        return <Widget {...schema} {...uiWidget} name={schemaKey}></Widget>
    }

    const ContainerComponent = globalRegistry[uiWidget.widget] || React.Fragment;
    const childComponents = []
    for (const property of Object.keys(schema[PROPERTIES_KEY])) {
        childComponents.push(<DynamicUIComponent
            schema={schema[PROPERTIES_KEY][property]}
            schemaKey={`${schemaKey ? schemaKey + "." : ""}${property}`}
            key={`${schemaKey ? schemaKey + "." : ""}${property}`}
            {...uiWidget}
        />)
    }
    return (<ContainerComponent>{childComponents}</ContainerComponent>)
});
