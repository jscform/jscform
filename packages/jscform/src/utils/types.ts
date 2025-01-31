import type {Ajv, JSONSchemaType} from 'ajv';

export type GenericObjectType = {
    [name: string]: any;
};

export type JSONSchema = JSONSchemaType<any> & GenericObjectType;

export type ValidatorType = Ajv;

export type FormContextType = GenericObjectType;
