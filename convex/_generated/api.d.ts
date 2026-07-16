/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aiSuggestionStore from "../aiSuggestionStore.js";
import type * as aiSuggestionsActions from "../aiSuggestionsActions.js";
import type * as auth from "../auth.js";
import type * as businessProfiles from "../businessProfiles.js";
import type * as businessWebsiteScan from "../businessWebsiteScan.js";
import type * as crons from "../crons.js";
import type * as files from "../files.js";
import type * as generatePost from "../generatePost.js";
import type * as generationCosts from "../generationCosts.js";
import type * as generationJobs from "../generationJobs.js";
import type * as http from "../http.js";
import type * as notifications from "../notifications.js";
import type * as onboardingAnswers from "../onboardingAnswers.js";
import type * as posts from "../posts.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  aiSuggestionStore: typeof aiSuggestionStore;
  aiSuggestionsActions: typeof aiSuggestionsActions;
  auth: typeof auth;
  businessProfiles: typeof businessProfiles;
  businessWebsiteScan: typeof businessWebsiteScan;
  crons: typeof crons;
  files: typeof files;
  generatePost: typeof generatePost;
  generationCosts: typeof generationCosts;
  generationJobs: typeof generationJobs;
  http: typeof http;
  notifications: typeof notifications;
  onboardingAnswers: typeof onboardingAnswers;
  posts: typeof posts;
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
