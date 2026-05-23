// Single source of truth for tool function-calling schemas.
// - Tavus persona registration consumes the `tavusTools` array (OpenAI-style).
// - Chat mode (Vercel AI SDK) consumes the Zod schemas from
//   `lib/tools/registry.ts` to derive JSON schemas for Claude.
// Whenever you add a tool, update both this file and `lib/tools/registry.ts`.

export type TavusToolSpec = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
      additionalProperties?: boolean;
    };
  };
};

const claimIdParam = {
  claim_id: { type: "string", description: "Acme internal claim UUID" },
};

export const tavusTools: TavusToolSpec[] = [
  {
    type: "function",
    function: {
      name: "verify_identity",
      description:
        "Verify the caller's identity against Acme records. Call before any policy lookup.",
      parameters: {
        type: "object",
        properties: {
          full_name: { type: "string" },
          dob_or_last4_ssn: {
            type: "string",
            description: "Caller's DOB in YYYY-MM-DD OR last 4 digits of SSN",
          },
          policy_number: { type: "string", description: "Optional if known" },
        },
        required: ["full_name", "dob_or_last4_ssn"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_policy_details",
      description: "Fetch policy summary, deductibles, prior claim count.",
      parameters: {
        type: "object",
        properties: { policy_id: { type: "string" } },
        required: ["policy_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "validate_coverage",
      description:
        "Check whether a specific peril (e.g. collision, theft, water_sudden) is covered on a policy. Always call before confirming coverage verbally.",
      parameters: {
        type: "object",
        properties: {
          policy_id: { type: "string" },
          claim_kind: { type: "string", enum: ["auto", "home", "renters"] },
          peril: { type: "string" },
        },
        required: ["policy_id", "claim_kind", "peril"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "start_claim",
      description: "Open a new claim row. Returns claim_id and claim_number.",
      parameters: {
        type: "object",
        properties: {
          policy_id: { type: "string" },
          kind: { type: "string", enum: ["auto", "home", "renters"] },
          incident_at: { type: "string", description: "ISO timestamp" },
        },
        required: ["policy_id", "kind"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "record_incident_details",
      description: "Persist incident facts to the claim.",
      parameters: {
        type: "object",
        properties: {
          ...claimIdParam,
          incident_at: { type: "string" },
          location: {
            type: "object",
            properties: {
              lat: { type: "number" },
              lng: { type: "number" },
              label: { type: "string" },
            },
            required: ["label"],
          },
          description: { type: "string" },
          details: {
            type: "object",
            description: "Per-kind details object; validated server-side",
            additionalProperties: true,
          },
        },
        required: ["claim_id", "incident_at", "description", "details"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_party",
      description: "Record another driver, witness, passenger, or third party.",
      parameters: {
        type: "object",
        properties: {
          ...claimIdParam,
          party_type: {
            type: "string",
            enum: ["other_driver", "witness", "passenger", "third_party"],
          },
          name: { type: "string" },
          contact: { type: "string" },
          insurance: {
            type: "object",
            properties: {
              carrier: { type: "string" },
              policy_number: { type: "string" },
            },
          },
        },
        required: ["claim_id", "party_type", "name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "request_photo_upload",
      description:
        "Generate signed Storage upload URLs and email the caller a link.",
      parameters: {
        type: "object",
        properties: {
          ...claimIdParam,
          photo_kinds: { type: "array", items: { type: "string" } },
        },
        required: ["claim_id", "photo_kinds"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_photos",
      description:
        "Wait for outstanding vision analyses (up to 15s) and return the synthesized assessment.",
      parameters: {
        type: "object",
        properties: { ...claimIdParam },
        required: ["claim_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "dispatch_tow",
      description: "Dispatch a mock tow partner to a pickup location.",
      parameters: {
        type: "object",
        properties: {
          ...claimIdParam,
          pickup_lat: { type: "number" },
          pickup_lng: { type: "number" },
          dropoff_preference: {
            type: "string",
            enum: ["nearest_shop", "home", "specified"],
          },
        },
        required: ["claim_id", "pickup_lat", "pickup_lng"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "book_rental",
      description: "Book a mock rental car.",
      parameters: {
        type: "object",
        properties: {
          ...claimIdParam,
          pickup_lat: { type: "number" },
          pickup_lng: { type: "number" },
          start_date: { type: "string" },
          vehicle_class: {
            type: "string",
            enum: ["economy", "midsize", "suv"],
          },
        },
        required: ["claim_id", "pickup_lat", "pickup_lng", "start_date", "vehicle_class"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_nearby_repair_shops",
      description: "PostGIS search for repair shops within a radius.",
      parameters: {
        type: "object",
        properties: {
          ...claimIdParam,
          lat: { type: "number" },
          lng: { type: "number" },
          radius_miles: { type: "number" },
          in_network_only: { type: "boolean" },
        },
        required: ["claim_id", "lat", "lng"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_adjuster_callback",
      description: "Book a mock adjuster phone or video callback.",
      parameters: {
        type: "object",
        properties: {
          ...claimIdParam,
          preferred_window_start: { type: "string" },
          preferred_window_end: { type: "string" },
          channel: { type: "string", enum: ["phone", "video"] },
        },
        required: ["claim_id", "preferred_window_start", "preferred_window_end", "channel"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "estimate_claim_value",
      description:
        "Derive a low/high payout estimate range from vision + coverage. Never returns a single number.",
      parameters: {
        type: "object",
        properties: { ...claimIdParam },
        required: ["claim_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "submit_claim",
      description: "Submit the claim after explicit user confirmation.",
      parameters: {
        type: "object",
        properties: {
          ...claimIdParam,
          user_confirmed: { type: "boolean" },
        },
        required: ["claim_id", "user_confirmed"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_summary",
      description: "Email the post-submission summary to the caller.",
      parameters: {
        type: "object",
        properties: { ...claimIdParam },
        required: ["claim_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_claim_status",
      description: "Look up current stage / status of a claim.",
      parameters: {
        type: "object",
        properties: {
          claim_id_or_number: { type: "string" },
        },
        required: ["claim_id_or_number"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "escalate_to_human",
      description: "Hand the conversation to a human supervisor.",
      parameters: {
        type: "object",
        properties: {
          ...claimIdParam,
          reason: { type: "string" },
          urgency: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["claim_id", "reason", "urgency"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "file_emergency",
      description:
        "Surface emergency resources (911 / poison control / roadside). Always call IMMEDIATELY on any injury/fire/gas/safety trigger.",
      parameters: {
        type: "object",
        properties: {
          ...claimIdParam,
          situation: { type: "string" },
        },
        required: ["claim_id", "situation"],
        additionalProperties: false,
      },
    },
  },
];

export type TavusToolName = (typeof tavusTools)[number]["function"]["name"];
