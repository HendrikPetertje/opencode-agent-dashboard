## ADDED Requirements

### Requirement: Settings table
The database SHALL have a `settings` table of key/value pairs, added by a new migration. It SHALL hold the agent tools setting under the key `agentTools` (`on` or `off`); a missing row SHALL mean off.

#### Scenario: Fresh or upgraded database
- **WHEN** the database is opened after this change
- **THEN** the `settings` table exists and the agent tools setting reads as off
