"use client";
import React, {ReactElement} from "react";
import {PROPERTIES_KEY, UI_WIDGET} from "../utils/constants";
import {globalRegistry} from "../createRegistry";
import {useControl} from "../hooks/useControl";

interface DynamicUIComponentProps {
    schemaKey: string;
    children?: ReactElement;
}

export default function DynamicUIComponent({schemaKey = ""}: DynamicUIComponentProps) {
    const {schema} = useControl(schemaKey);
    if(!schema) {
        return null;
    }
    if (!schema[UI_WIDGET]) {
        throw Error(`${UI_WIDGET} property missing for "${schemaKey}"`);
    }
    if (!schema[PROPERTIES_KEY]) {
        const uiWidget = schema[UI_WIDGET];
        const Widget = globalRegistry[uiWidget.widget];
        if (!Widget) {
            throw Error(`Widget "${uiWidget.widget}" not found in registry`);
        }
        return <Widget {...schema} {...uiWidget} name={schemaKey}></Widget>
    }
    const uiWidget = schema[UI_WIDGET];
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
}
