import type {Ajv, JSONSchemaType, ErrorObject, DefinedError} from 'ajv';

export type GenericObjectType = {
    [name: string]: any;
};

export type JSONSchema = JSONSchemaType<any> & GenericObjectType;

export type ValidatorType = Ajv;

export type FormContextType = GenericObjectType;

export type ErrorMessage = ErrorObject<'errorMessage', { errors: (DefinedError & { emUsed: boolean })[] }>;
export type AjvError = ErrorObject | ErrorMessage | DefinedError;
