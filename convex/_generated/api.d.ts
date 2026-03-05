/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as blockPresets from "../blockPresets.js";
import type * as groups from "../groups.js";
import type * as http from "../http.js";
import type * as inputChannels from "../inputChannels.js";
import type * as ioDevices from "../ioDevices.js";
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
  auth: typeof auth;
  blockPresets: typeof blockPresets;
  groups: typeof groups;
  http: typeof http;
  inputChannels: typeof inputChannels;
  ioDevices: typeof ioDevices;
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
