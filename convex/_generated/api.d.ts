/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _helpers_mcpCredentials from "../_helpers/mcpCredentials.js";
import type * as _helpers_portGeneration from "../_helpers/portGeneration.js";
import type * as _helpers_projectAccess from "../_helpers/projectAccess.js";
import type * as _helpers_projectActivity from "../_helpers/projectActivity.js";
import type * as auth from "../auth.js";
import type * as blockPresets from "../blockPresets.js";
import type * as collaboration from "../collaboration.js";
import type * as groups from "../groups.js";
import type * as http from "../http.js";
import type * as inputChannels from "../inputChannels.js";
import type * as inventoryIODevices from "../inventoryIODevices.js";
import type * as inventoryMixers from "../inventoryMixers.js";
import type * as ioDevices from "../ioDevices.js";
import type * as mcp from "../mcp.js";
import type * as mcpCredentials from "../mcpCredentials.js";
import type * as migrations from "../migrations.js";
import type * as mixers from "../mixers.js";
import type * as outputChannels from "../outputChannels.js";
import type * as patching from "../patching.js";
import type * as projects from "../projects.js";
import type * as snapshots from "../snapshots.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "_helpers/mcpCredentials": typeof _helpers_mcpCredentials;
  "_helpers/portGeneration": typeof _helpers_portGeneration;
  "_helpers/projectAccess": typeof _helpers_projectAccess;
  "_helpers/projectActivity": typeof _helpers_projectActivity;
  auth: typeof auth;
  blockPresets: typeof blockPresets;
  collaboration: typeof collaboration;
  groups: typeof groups;
  http: typeof http;
  inputChannels: typeof inputChannels;
  inventoryIODevices: typeof inventoryIODevices;
  inventoryMixers: typeof inventoryMixers;
  ioDevices: typeof ioDevices;
  mcp: typeof mcp;
  mcpCredentials: typeof mcpCredentials;
  migrations: typeof migrations;
  mixers: typeof mixers;
  outputChannels: typeof outputChannels;
  patching: typeof patching;
  projects: typeof projects;
  snapshots: typeof snapshots;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
