# DevEx Portal Strategy Overview

## Vision

1. **Developer Experience Portal:** Provide a unified, application-centric portal where developers can discover platform capabilities, understand application status, execute governed actions, complete guided journeys, and diagnose failures.
2. **One Portal. One Experience. Multiple Clouds.** Deliver a consistent developer experience across public clouds and software delivery platforms.
3. **Outcome-Oriented:** Help developers achieve outcomes with the right context, actions, guidance, status, and diagnosis instead of merely aggregating tools and links.
4. **Governed Orchestration:** DevEx Portal owns the experience, guidance, state, and evidence, while underlying platforms retain execution, approval, authorization, and domain ownership.

## Executive Summary

1. **Application-Centric Experience**
   DevEx Portal organizes cloud and SDLC capabilities around the application rather than individual tools. It connects teams, environments, accounts, repositories, pipelines, infrastructure, access, tickets, documentation, and support within a shared application context.

2. **Guided Journeys and Golden Paths**
   DevEx Portal guides developers through complex outcomes such as managed-cloud onboarding and the first successful development deployment. It coordinates prerequisites, decisions, actions, approvals, external dependencies, blockers, validation, and evidence across multiple systems.

3. **Governed Self-Service**
   DevEx Portal enables developers to request access, create platform resources, and trigger deployments through contextual and governed actions. Execution, authorization, and approval remain with the responsible source systems.

4. **Intelligent Diagnosis and Recovery**
   DevEx Portal correlates application context, execution status, logs, configuration, platform changes, and known issues to explain failures and recommend evidence-based recovery actions.

5. **Outcome-Driven Platform Experience**
   DevEx Portal measures success through completed onboarding, successful deployments, reduced manual effort, fewer system switches, shorter blocked time, faster diagnosis, and greater Golden Path adoption rather than portal traffic alone.

## Roadmap

### Phase 1: Establish the MVP Foundation

1. Implement enterprise identity, application resolution, team and owner mapping, and basic authorization.
2. Build Application Workbench Lite with cloud account, environment, repository, infrastructure automation, delivery automation, request, documentation, and support context.
3. Define the managed-container Golden Path, including step owners, prerequisites, completion criteria, evidence rules, and support routes.
4. Establish minimum viable integrations with access management, service management, infrastructure automation, delivery automation, secrets management, and cloud data sources.
5. Introduce outcome analytics for onboarding progress, blockers, manual handoffs, system switches, and action results.

### Phase 2: Deliver and Validate the Pilot

1. Launch the complete **Managed Cloud Application Onboarding** experience.
2. Deliver three core governed actions:
   - Submit access requests.
   - Create delivery projects, connectors, and pipelines.
   - Trigger and track development deployments.
3. Provide targeted diagnosis for access mapping, account and connector mismatches, naming errors, dependency scans, infrastructure outputs, task definitions, secrets, and deployment failures.
4. Validate the platform with pilot applications completing onboarding and their first successful development deployments.
5. Measure onboarding lead time, blocked time, action success rates, system-switch reduction, diagnosis effectiveness, and Golden Path adoption.

### Expansion

1. Expand DevEx Portal from an onboarding solution into a daily Application Workbench.
2. Introduce Application 360 with deployment history, resource and cost summaries, tickets, changes, incidents, known issues, and release impact.
3. Expand the Task Center and Quick Starts for access, secrets, infrastructure automation, delivery automation, runtime configuration, deployment, and support.
4. Add guided experiences for production readiness, secrets onboarding, pipeline migration, and additional managed-cloud workload patterns.
5. Extend the model to additional cloud environments and workload types while preserving cloud-native concepts and differences.
6. Improve diagnosis with richer evidence correlation, application-aware recommendations, and assisted ticket or workflow preparation.

### Future Direction

1. Establish a unified cross-cloud model for experience, state, outcomes, evidence, and governance.
2. Expand Golden Paths across the application lifecycle, including onboarding, delivery, operations, security, migration, and resilience.
3. Proactively identify version, compliance, cost, ownership, platform-change, and operational risks.
4. Deliver assisted remediation that prepares pull requests, tickets, configuration changes, and workflow inputs for human review and execution.
5. Provide outcome and experience analytics across teams, applications, platforms, and cloud environments.
6. Position DevEx Portal as the enterprise multi-cloud Developer Experience Portal across the SDLC without replacing infrastructure automation, delivery automation, access management, service management, observability platforms, or cloud consoles.

## Scenario A: Managed Cloud Application Onboarding

### Problem
Application teams must navigate access management, service management, infrastructure automation, delivery automation, secrets management, and cloud systems independently to complete onboarding. They repeatedly enter the same information and lack a unified view of prerequisites, dependencies, ownership, progress, blockers, and completion criteria.

### Platform Experience
DevEx Portal resolves the application context, checks prerequisites, and guides the team through the managed-cloud onboarding Golden Path. It coordinates access requests, account and environment mapping, repository readiness, infrastructure workspace status, delivery setup, artifact readiness, runtime configuration, development deployment, health validation, and completion evidence.

### Business Value
Reduce onboarding lead time, manual work, repeated data entry, system switching, and support handoffs while increasing onboarding completion rates, Golden Path adoption, and successful first DEV deployments.

## Scenario B: Deployment Failure Diagnosis

### Problem
When a deployment fails, developers must manually correlate pipeline stages, logs, infrastructure outputs, task definitions, secrets, platform changes, known issues, and support contacts across multiple systems.

### Platform Experience
DevEx Portal identifies the application, environment, failed run, and failed stage. It aggregates relevant context and evidence, presents likely causes with confidence levels, recommends the next action or runbook, and prepares a governed recovery workflow or prefilled support ticket.

### Business Value
Reduce mean time to diagnose, repeated failures, and unnecessary support handoffs while improving recovery speed, developer productivity, and deployment reliability.

## Scenario C: Daily Application Workbench

### Problem
Application information is fragmented across cloud and software delivery systems. Teams struggle to understand current state, blockers, ownership, platform changes, risks, and available actions.

### Platform Experience
DevEx Portal provides an application-centric workbench covering environments, accounts, repositories, infrastructure workspaces, delivery pipelines, resources, deployments, requests, tickets, documentation, costs, and support. Users can launch Quick Starts and governed actions directly from the relevant context.

### Business Value
Create a consistent daily developer experience, reduce tool fragmentation, improve application visibility, accelerate routine tasks, strengthen governance, and increase adoption of approved platform capabilities.

## Strategic Outcome

DevEx Portal will enable application teams to move from intent to verified outcomes without needing to understand every organizational, cloud, and tooling boundary.

The first proof point is:

> **A pilot application team completes managed-cloud onboarding and achieves its first successful development deployment through DevEx Portal, with verified evidence and a clear recovery path when failures occur.**
