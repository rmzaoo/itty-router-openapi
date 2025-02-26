import {
  EnumerationParameterType,
  ParameterLocation,
  ParameterType,
  RegexParameterType,
  RouteParameter,
  StringParameterType,
} from './types'
import { z, ZodObject } from 'zod'
import { isSpecificZodType, legacyTypeIntoZod } from './zod/utils'
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'
import { ZodType } from 'zod'

if (z.string().openapi === undefined) {
  // console.log('zod extension applied')
  extendZodWithOpenApi(z)
}

export function convertParams(field: any, params: any): ZodType {
  params = params || {}
  if (params.required === false)
    // @ts-ignore
    field = field.optional()

  if (params.description) field = field.describe(params.description)

  if (params.default)
    // @ts-ignore
    field = field.default(params.default)

  if (params.example) {
    field = field.openapi({ example: params.example })
  }

  if (params.format) {
    field = field.openapi({ format: params.format })
  }

  return field
}

export class Arr {
  static generator = true

  constructor(innerType: any, params?: ParameterType) {
    return convertParams(legacyTypeIntoZod(innerType).array(), params)
  }
}

export class Obj {
  static generator = true

  constructor(fields: object, params?: ParameterType) {
    const parsed: Record<string, any> = {}
    for (const [key, value] of Object.entries(fields)) {
      parsed[key] = legacyTypeIntoZod(value)
    }

    return convertParams(z.object(parsed), params)
  }
}

export class Num {
  static generator = true

  constructor(params?: ParameterType) {
    return convertParams(
      z.number().or(z.string()).pipe(z.coerce.number()),
      params
    ).openapi({
      type: 'number',
    })
  }
}

export class Int {
  static generator = true

  constructor(params?: ParameterType) {
    return convertParams(
      z.number().int().or(z.string()).pipe(z.coerce.number()),
      params
    ).openapi({
      type: 'integer',
    })
  }
}

export class Str {
  static generator = true

  constructor(params?: StringParameterType) {
    return convertParams(z.string(), params)
  }
}

export class DateTime {
  static generator = true

  constructor(params?: ParameterType) {
    return convertParams(
      z.string().datetime({
        message: 'Must be in the following format: YYYY-mm-ddTHH:MM:ssZ',
      }),
      params
    )
  }
}

export class Regex {
  static generator = true

  constructor(params: RegexParameterType) {
    return convertParams(
      // @ts-ignore
      z.string().regex(params.pattern, params.patternError || 'Invalid'),
      params
    )
  }
}

export class Email {
  static generator = true

  constructor(params?: ParameterType) {
    return convertParams(z.string().email(), params)
  }
}

export class Uuid {
  static generator = true

  constructor(params?: ParameterType) {
    return convertParams(z.string().uuid(), params)
  }
}

export class Hostname {
  static generator = true

  constructor(params?: ParameterType) {
    return convertParams(
      z
        .string()
        .regex(
          /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9-]*[A-Za-z0-9])$/
        ),
      params
    )
  }
}

export class Ipv4 {
  static generator = true

  constructor(params?: ParameterType) {
    return convertParams(z.coerce.string().ip({ version: 'v4' }), params)
  }
}

export class Ipv6 {
  static generator = true

  constructor(params?: ParameterType) {
    return convertParams(z.string().ip({ version: 'v6' }), params)
  }
}

export class DateOnly {
  static generator = true

  constructor(params?: ParameterType) {
    return convertParams(z.coerce.date(), params)
  }
}

export class Bool {
  static generator = true

  constructor(params?: ParameterType) {
    return convertParams(
      z.coerce
        .string()
        .toLowerCase()
        .pipe(z.enum(['true', 'false']).transform((val) => val === 'true')),
      params
    ).openapi({
      type: 'boolean',
    })
  }
}

export class Enumeration {
  static generator = true

  constructor(params: EnumerationParameterType) {
    let { values } = params
    const originalValues = { ...values }

    if (Array.isArray(values))
      values = Object.fromEntries(values.map((x) => [x, x]))

    const originalKeys: [string, ...string[]] = Object.keys(values) as [
      string,
      ...string[]
    ]

    if (params.enumCaseSensitive === false) {
      values = Object.keys(values).reduce((accumulator, key) => {
        // @ts-ignore
        accumulator[key.toLowerCase()] = values[key]
        return accumulator
      }, {})
    }

    const keys: [string, ...string[]] = Object.keys(values) as [
      string,
      ...string[]
    ]

    let field
    if ([undefined, true].includes(params.enumCaseSensitive)) {
      field = z.enum(keys)
    } else {
      field = z
        .preprocess((val) => String(val).toLowerCase(), z.enum(keys))
        .openapi({ enum: originalKeys })
    }

    field = field.transform((val) => values[val])

    const result = convertParams(field, params)

    // Keep retro compatibility
    //@ts-ignore
    result.values = originalValues

    return result
  }
}

export function Query(
  type: any,
  params: ParameterLocation = {}
): RouteParameter {
  return {
    name: params.name,
    location: 'query',
    type: legacyTypeIntoZod(type, params),
  }
}

export function Path(
  type: any,
  params: ParameterLocation = {}
): RouteParameter {
  return {
    name: params.name,
    location: 'params',
    type: legacyTypeIntoZod(type, params),
  }
}

export function Header(
  type: any,
  params: ParameterLocation = {}
): RouteParameter {
  return {
    name: params.name,
    location: 'headers',
    type: legacyTypeIntoZod(type, params),
  }
}

export function extractParameter(
  request: Request,
  query: Record<string, any>,
  name: string,
  location: string
): any {
  if (location === 'query') {
    return query[name]
  }
  if (location === 'path') {
    // @ts-ignore
    return request.params[name]
  }
  if (location === 'header') {
    // @ts-ignore
    return request.headers.get(name)
  }
  if (location === 'cookie') {
    throw new Error('Cookie parameters not implemented yet')
  }
}

export function extractQueryParameters(
  request: Request,
  schema?: ZodObject<any>
): Record<string, any> | null {
  const { searchParams } = new URL(request.url)

  if (searchParams.size === 0) {
    return null
  }

  const params: Record<string, any> = {}
  for (let [key, value] of searchParams.entries()) {
    // Query parameters can be empty strings, that should equal to null as nothing was provided
    if (value === '') {
      // @ts-ignore
      value = null
    }

    if (params[key] === undefined) {
      params[key] = value
    } else if (!Array.isArray(params[key])) {
      params[key] = [params[key], value]
    } else {
      params[key].push(value)
    }

    // Soft transform query strings into arrays
    if (schema && schema.shape[key]) {
      if (
        isSpecificZodType(schema.shape[key], 'ZodArray') &&
        !Array.isArray(params[key])
      ) {
        params[key] = [params[key]]
      } else if (isSpecificZodType(schema.shape[key], 'ZodBoolean')) {
        // z.preprocess(
        // (val) => String(val).toLowerCase(),
        // z.enum(['true', 'false']).transform((val) => val === 'true')
        // ),
      }
    }
  }

  return params
}
