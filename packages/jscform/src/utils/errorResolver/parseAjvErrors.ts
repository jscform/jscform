import {AjvError} from "../types";
import {set} from "lodash";


export const parseAjvErrors = (ajvErrors: AjvError[] | null | undefined) => {
    if(ajvErrors === null || ajvErrors === undefined) {
        return null;
    }
    const parsedErrors: Record<string, any> = {};
    const reduceError = (error: AjvError) => {
        // Ajv will return empty instancePath when require error
        if (error.keyword === 'required') {
            error.instancePath += `/${error.params.missingProperty}`;
        }

        // `/deepObject/data` -> `deepObject.data`
        const path = error.instancePath.substring(1).replace(/\//g, '.');

        if (!parsedErrors[path]) {
            parsedErrors[path] = {
                message: error.message,
                type: error.keyword,
            };
        }
    };
    for (let index = 0; index < ajvErrors.length; index += 1) {
        const error = ajvErrors[index];
        if (error.keyword === 'errorMessage') {
            error.params.errors.forEach((originalError: AjvError) => {
                originalError.message = error.message;
                reduceError(originalError);
            });
        } else {
            reduceError(error);
        }
    }
    return parsedErrors;
}

export const toNestErrors = (errors: Record<string, any>): any => {
    const errorObj = {};

    for (const key in errors) {
        const error = errors[key];
        set(errorObj, key, error);
    }
    return errorObj;
};
