/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable jsdoc/require-jsdoc */
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import got from 'got';
import {ESLint} from 'eslint';
import {JsonObject} from 'type-fest';

// protoco.json typing
interface GeneratedProtocol {
	enums: Array<{enumType: string; enumIdentifiers: EnumIdentifier[]}>;
	requests: OBSRequest[];
	events: OBSEvent[];
}

interface EnumIdentifier {
	description: string;
	enumIdentifier: string;
	rpcVersion: string;
	deprecated: boolean;
	initialVersion: string;
	enumValue: number | string;
}

interface OBSRequest {
	description: string;
	requestType: string;
	complexity: number;
	rpcVersion: string;
	deprecated: boolean;
	initialVersion: string;
	category: string;
	requestFields: OBSRequestField[];
	responseFields: OBSResponseField[];
}

interface OBSRequestField {
	valueName: string;
	valueType: string;
	valueDescription: string;
	valueRestrictions: null | string;
	valueOptional: boolean;
	valueOptionalBehavior: null | string;
}

interface OBSResponseField {
	valueName: string;
	valueType: string;
	valueDescription: string;
}

function isObsRequestField(val: OBSRequestField | OBSResponseField): val is OBSRequestField {
	return 'valueOptional' in val;
}

interface OBSEvent {
	description: string;
	eventType: string;
	eventSubscription: string;
	complexity: number;
	rpcVersion: string;
	deprecated: boolean;
	initialVersion: string;
	category: string;
	dataFields: OBSEventField[];
}

interface OBSEventField {
	valueName: string;
	valueType: string;
	valueDescription: string;
}

const OUTPUT_FILE = join(process.cwd(), 'src/types.ts');
const headers = {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	Authorization: process.env.GH_TOKEN ? `token ${process.env.GH_TOKEN}` : undefined,
};

// Defaulting to the branch for now to get the latest docs-only changes
let commit = process.argv[2] ?? process.env.GH_COMMIT ?? 'master';
if (!commit) {
	const {body: release} = await got('https://api.github.com/repos/obsproject/obs-websocket/releases/latest', {
		headers,
		responseType: 'json',
	});
	commit = (release as JsonObject).tag_name as string;
}

const {body: protocol} = await got<GeneratedProtocol>(`https://raw.githubusercontent.com/obsproject/obs-websocket/${commit}/docs/generated/protocol.json`, {
	headers,
	responseType: 'json',
});

// fix oopsie in protocol.json (5.0.1)
protocol.requests.forEach(req => {
	if (req.requestType === 'GetGroupItemList') {
		req.requestType = 'GetGroupSceneItemList';
	}
});

const ENUMS: Record<string, EnumIdentifier[]> = {};
protocol.enums.forEach(({enumType, enumIdentifiers}) => {
	ENUMS[enumType] = enumIdentifiers;
});

const source = `/**
 * This file is autogenerated by scripts/build-types.ts
 * To update this with latest changes do npm run generate:obs-types
 */
import {Merge, JsonArray, JsonObject, JsonValue} from 'type-fest';

${generateEnum('WebSocketOpCode', ENUMS.WebSocketOpCode)}

/* eslint-disable no-bitwise, @typescript-eslint/prefer-literal-enum-member */
${generateEnum('EventSubscription', ENUMS.EventSubscription)}
/* eslint-enable no-bitwise, @typescript-eslint/prefer-literal-enum-member */

${generateEnum('RequestBatchExecutionType', ENUMS.RequestBatchExecutionType)}

// WebSocket Message Types
export type IncomingMessage<Type = keyof IncomingMessageTypes> = Type extends keyof IncomingMessageTypes ? {
	op: Type;
	d: IncomingMessageTypes[Type];
} : never;

export type OutgoingMessage<Type = keyof OutgoingMessageTypes> = Type extends keyof OutgoingMessageTypes ? {
	op: Type;
	d: OutgoingMessageTypes[Type];
} : never;

export interface IncomingMessageTypes {
	/**
	 * Message sent from the server immediately on client connection. Contains authentication information if auth is required. Also contains RPC version for version negotiation.
	 */
	[WebSocketOpCode.Hello]: {
		/**
		 * Version number of obs-websocket
		 */
		obsWebSocketVersion: string;
		/**
		 * Version number which gets incremented on each breaking change to the obs-websocket protocol.
		 * It's usage in this context is to provide the current rpc version that the server would like to use.
		 */
		rpcVersion: number;
		/**
		 * Authentication challenge when password is required
		 */
		authentication?: {
			challenge: string;
			salt: string;
		};
	};
	/**
	 * The identify request was received and validated, and the connection is now ready for normal operation.
	 */
	[WebSocketOpCode.Identified]: {
		/**
		 * If rpc version negotiation succeeds, the server determines the RPC version to be used and gives it to the client
		 */
		negotiatedRpcVersion: number;
	};
	/**
	 * An event coming from OBS has occured. Eg scene switched, source muted.
	 */
	[WebSocketOpCode.Event]: EventMessage;
	/**
	 * obs-websocket is responding to a request coming from a client
	 */
	[WebSocketOpCode.RequestResponse]: ResponseMessage;
	/**
	 * obs-websocket is responding to a batch request coming from a client
	 */
	[WebSocketOpCode.RequestBatchResponse]: ResponseBatchMessage;
}

export interface OutgoingMessageTypes {
	/**
	 * Response to Hello message, should contain authentication string if authentication is required, along with PubSub subscriptions and other session parameters.
	 */
	[WebSocketOpCode.Identify]: {
		/**
		 * Version number that the client would like the obs-websocket server to use
		 */
		rpcVersion: number;
		/**
		 * Authentication challenge response
		 */
		authentication?: string;
		/**
		 * Bitmask of \`EventSubscription\` items to subscribe to events and event categories at will. By default, all event categories are subscribed, except for events marked as high volume. High volume events must be explicitly subscribed to.
		 */
		eventSubscriptions?: number;
	};
	/**
	 * Sent at any time after initial identification to update the provided session parameters.
	 */
	[WebSocketOpCode.Reidentify]: {
		/**
		 * Bitmask of \`EventSubscription\` items to subscribe to events and event categories at will. By default, all event categories are subscribed, except for events marked as high volume. High volume events must be explicitly subscribed to.
		 */
		eventSubscriptions?: number;
	};
	/**
	 * Client is making a request to obs-websocket. Eg get current scene, create source.
	 */
	[WebSocketOpCode.Request]: RequestMessage;
	/**
	 * Client is making a batch request to obs-websocket.
	 */
	[WebSocketOpCode.RequestBatch]: RequestBatchMessage;
}

type EventMessage<T = keyof OBSEventTypes> = T extends keyof OBSEventTypes ? {
	eventType: T;
	/**
	 * The original intent required to be subscribed to in order to receive the event.
	 */
	eventIntent: number;
	eventData: OBSEventTypes[T];
} : never;

export type RequestMessage<T = keyof OBSRequestTypes> = T extends keyof OBSRequestTypes ? {
	requestType: T;
	requestId: string;
	requestData: OBSRequestTypes[T];
} : never;

export type RequestBatchRequest<T = keyof OBSRequestTypes> = T extends keyof OBSRequestTypes ? OBSRequestTypes[T] extends never ? {
	requestType: T;
	requestId?: string;
} : {
	requestType: T;
	requestId?: string;
	requestData: OBSRequestTypes[T];
} : never;

export type RequestBatchOptions = {
	/**
	 * The mode of execution obs-websocket will run the batch in
	 */
	executionType?: RequestBatchExecutionType;
	/**
	 * Whether obs-websocket should stop executing the batch if one request fails
	 */
	haltOnFailure?: boolean;
}

export type RequestBatchMessage = Merge<RequestBatchOptions, {
	requestId: string;
	requests: RequestBatchRequest[];
}>;

export type ResponseMessage<T = keyof OBSResponseTypes> = T extends keyof OBSResponseTypes ? {
	requestType: T;
	requestId: string;
	requestStatus: {result: true; code: number} | {result: false; code: number; comment: string};
	responseData: OBSResponseTypes[T];
} : never;

export type ResponseBatchMessage = {
	requestId: string;
	results: ResponseMessage[];
}

// Events
export interface OBSEventTypes {
	${generateObsEventTypes(protocol.events)}
}

// Requests and Responses
export interface OBSRequestTypes {
	${generateObsRequestTypes(protocol.requests)}
}

export interface OBSResponseTypes {
	${generateObsResponseTypes(protocol.requests)}
}
`;
/* typescript provides worse autocomplete results and errors with these
// Overrides to improve typescript for requests without data and to provide documentation
declare module './base' {
	interface BaseOBSWebSocket {
		${generateObsRequestOverrides(protocol.requests)}
		${generateObsListenerOverrides(protocol.events)}
	}
}
*/

const linter = new ESLint({fix: true});
const linted = await linter.lintText(source, {
	filePath: OUTPUT_FILE,
});

if (linted[0].messages.length > 0) {
	const formatter = await linter.loadFormatter('stylish');
	process.stderr.write(await formatter.format(linted));
	process.exitCode = 1;
}

writeFileSync(OUTPUT_FILE, linted[0].output ?? source);

// Utility funcs
function formatJsDoc(jsdoc: string[]) {
	return [
		'/**',
		...jsdoc.map(s => ` * ${s}`),
		' */',
	].join('\n');
}

function generateEnum(type: string, identifiers: EnumIdentifier[]): string {
	return [
		`export enum ${type} {`,
		...identifiers.map(value => {
			const jsdoc: string[] = [
				...value.description.split('\n'),
				'',
				`Initial OBS Version: ${value.initialVersion}`,
			];
			if (value.deprecated) {
				jsdoc.push('', '@deprecated');
			}

			return [
				formatJsDoc(jsdoc),
				`${value.enumIdentifier} = ${value.enumValue},`,
			].join('\n');
		}),
		'}',
	].join('\n');
}

function generateObsEventTypes(events: OBSEvent[]): string {
	return events.map(ev => {
		if (ev.dataFields.length === 0) {
			return `${ev.eventType}: undefined;`;
		}

		return `${ev.eventType}: ${stringifyTypes(unflattenAndResolveTypes(ev.dataFields))};`;
	}).join('\n');
}

function generateObsRequestTypes(requests: OBSRequest[]): string {
	return requests.map(req => {
		if (req.requestFields.length === 0) {
			return `${req.requestType}: never;`;
		}

		return `${req.requestType}: ${stringifyTypes(unflattenAndResolveTypes(req.requestFields))};`;
	}).join('\n');
}

function generateObsResponseTypes(requests: OBSRequest[]): string {
	return requests.map(req => {
		if (req.responseFields.length === 0) {
			return `\t${req.requestType}: undefined;`;
		}

		return `${req.requestType}: ${stringifyTypes(unflattenAndResolveTypes(req.responseFields))};`;
	}).join('\n');
}

function generateObsListenerOverrides(events: OBSEvent[]): string {
	return events.map(ev => {
		const jsdoc: string[] = [
			...ev.description.split('\n'),
			'',
			`@category ${ev.category}`,
			`@initialVersion ${ev.initialVersion}`,
			`@rpcVersion ${ev.rpcVersion}`,
			`@complexity ${ev.complexity}`,
		];
		if (ev.deprecated) {
			jsdoc.push('@deprecated');
		}

		return [
			formatJsDoc(jsdoc),
			`on(event: '${ev.eventType}', listener: (data: OBSEventTypes['${ev.eventType}']) => void): this;`,
		].join('\n');
	}).join('\n');
}

function generateObsRequestOverrides(requests: OBSRequest[]): string {
	return requests.map(req => {
		const jsdoc: string[] = [
			...req.description.split('\n'),
			'',
			`@category ${req.category}`,
			`@initialVersion ${req.initialVersion}`,
			`@rpcVersion ${req.rpcVersion}`,
			`@complexity ${req.complexity}`,
		];
		if (req.deprecated) {
			jsdoc.push('@deprecated');
		}

		const requestData = req.requestFields.length > 0
			? `requestData: OBSRequestTypes['${req.requestType}']`
			: 'requestData?: never';

		return [
			formatJsDoc(jsdoc),
			`call(requestType: '${req.requestType}', ${requestData}): Promise<OBSResponseTypes['${req.requestType}']>;`,
		].join('\n');
	}).join('\n');
}

type Tree = Record<string, AnyType>;

interface BaseType {
	optional?: boolean;
	jsdoc?: string;
}

interface PrimitiveType extends BaseType {
	type: 'string' | 'number' | 'boolean';
}

interface JsonValueType extends BaseType {
	type: 'jsonvalue';
	properties: Tree;
}

interface ObjectType extends BaseType {
	type: 'object';
	properties: Tree;
}

interface ArrayType extends BaseType {
	type: 'array';
	items: PrimitiveType | ObjectType;
}

type AnyType = PrimitiveType | JsonValueType | ObjectType | ArrayType;

function unflattenAndResolveTypes(inputItems: Array<OBSRequestField | OBSResponseField>): ObjectType {
	const root: ObjectType = {
		type: 'object',
		properties: {},
	};

	const items = inputItems.slice(0);

	// Sort items by depth (number of dots in their key).
	// This ensures that we build our tree starting from the roots and ending at the leaves.
	items.sort((a, b) => {
		const DOTS_REGEX = /\./g;
		const aDots = a.valueName.match(DOTS_REGEX);
		const bDots = b.valueName.match(DOTS_REGEX);
		return (aDots?.length ?? 0) - (bDots?.length ?? 0);
	});

	// Build the tree, one item at a time.
	items.forEach(item => {
		// Split the name of this item into parts, splitting it at each dot character.
		const parts = item.valueName.split('.');

		const lastPart = parts.pop()!;
		let currentNode: AnyType = root;
		parts.forEach((nodeName, i) => {
			if (nodeName === '*') {
				if (currentNode.type !== 'array' || currentNode.items.type !== 'object') {
					throw new Error(`Unexpected object already exists for * key
	currentNode: ${JSON.stringify(currentNode)}
	item: ${JSON.stringify(item)}
`);
				}

				currentNode = currentNode.items;
			}

			if (currentNode.type !== 'object') {
				throw new Error(`Unexpected current object type
	currentNode: ${JSON.stringify(currentNode)}
	item: ${JSON.stringify(item)}
	nodeName: ${nodeName}
`);
			}

			if (!(nodeName in currentNode.properties)) {
				if (parts[i + 1] === '*') {
					currentNode.properties[nodeName] = {
						type: 'array',
						items: {
							type: 'object',
							properties: {},
						},
					};
				} else {
					currentNode.properties[nodeName] = {
						type: 'object',
						properties: {},
					};
				}
			}

			currentNode = currentNode.properties[nodeName];
		});

		if (lastPart === '*') {
			// Expecting this doesn't happen as there's Array<Subtype> type
			throw new Error(`Need to add last * handler
	currentNode: ${JSON.stringify(currentNode)}
	item: ${JSON.stringify(item)}
`);
		}

		if (currentNode.type !== 'object') {
			throw new Error(`Current node isn't an object
	currentNode: ${JSON.stringify(currentNode)}
	item: ${JSON.stringify(item)}
`);
		}

		currentNode.properties[lastPart] = resolveType(item);
	});

	return root;
}

function resolveType(field: OBSRequestField | OBSResponseField): AnyType {
	const type = getBaseType(field.valueType);

	type.jsdoc = field.valueDescription;

	if (isObsRequestField(field)) {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		const {valueRestrictions, valueOptional, valueOptionalBehavior} = field;
		type.optional = valueOptional;
		if (valueRestrictions) {
			type.jsdoc += `\n@restrictions ${valueRestrictions}`;
		}

		if (valueOptionalBehavior) {
			type.jsdoc += `\n@defaultValue ${valueOptionalBehavior}`;
		}
	}

	return type;
}

function getBaseType(inType: string): AnyType {
	const ARRAY_PREFIX = 'Array<';
	if (inType.startsWith(ARRAY_PREFIX)) {
		const subType = inType.substring(ARRAY_PREFIX.length, inType.lastIndexOf('>'));

		return {
			type: 'array',
			items: getBaseType(subType) as ArrayType['items'],
		};
	}

	switch (inType) {
		case 'Boolean':
			return {
				type: 'boolean',
			};
		case 'String':
			return {
				type: 'string',
			};
		case 'Number':
			return {
				type: 'number',
			};
		case 'Object':
			return {
				type: 'object',
				properties: {},
			};
		case 'Any':
			return {
				type: 'jsonvalue',
				properties: {},
			};
		default:
			throw new Error(`Unknown type: ${inType}`);
	}
}

function stringifyTypes(inputTypes: AnyType): string {
	switch (inputTypes.type) {
		case 'object':
			return stringifyObject(inputTypes);
		case 'array': {
			const subtype = stringifyTypes(inputTypes.items);

			if (subtype === 'JsonObject') {
				return 'JsonObject[]';
			}

			return `Array<${subtype}>`;
		}

		case 'jsonvalue':
			return 'JsonValue';
		default:
			return inputTypes.type;
	}
}

function stringifyObject(inputTypes: ObjectType): string {
	if (Object.keys(inputTypes.properties).length === 0) {
		return 'JsonObject';
	}

	const properties: string[] = [];

	Object.entries(inputTypes.properties).forEach(([key, typeDef]) => {
		const separator = typeDef.optional ? '?:' : ':';
		const type = stringifyTypes(typeDef);

		if (typeDef.jsdoc) {
			properties.push(formatJsDoc(typeDef.jsdoc.split('\n')));
		}

		properties.push(`${key}${separator} ${type};`);
	});

	return [
		'{',
		...properties,
		'}',
	].join('\n');
}
