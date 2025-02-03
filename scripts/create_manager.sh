#!/bin/bash

# Check if service token is provided
if [ -z "${RIVET_SERVICE_TOKEN}" ]; then
    echo "Error: RIVET_SERVICE_TOKEN environment variable is required"
    exit 1
fi

# Check if manager build ID is provided
if [ -z "${MANAGER_BUILD_ID}" ]; then
    echo "Error: MANAGER_BUILD_ID environment variable is required"
    exit 1
fi

# Create manager actor
curl -X POST http://localhost:8080/actors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${RIVET_SERVICE_TOKEN}" \
  -d '{
    "tags": { "name": "manager", "owner": "rivet" },
    "build": "'"${MANAGER_BUILD_ID}"'",
    "runtime": {
      "environment": {
        "RIVET_SERVICE_TOKEN": "'"${RIVET_SERVICE_TOKEN}"'"
      }
    },
    "network": {
      "mode": "bridge",
      "ports": {
        "http": {
          "protocol": "https",
          "routing": {
            "guard": {}
          }
        }
      }
    },
    "lifecycle": {
      "durable": true
    }
  }'
