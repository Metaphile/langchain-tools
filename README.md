# Hierarchical Agent Proof-of-Concept

Theoretically we could create a single agent with a whole bunch of tools, but describing all of those tools would eat up precious tokens and might confuse the LLM.

Another approach is to divide functionality into categories, create a separate agent and toolset for each category, and delegate to those agents from a top-level catchall agent. That is the approach demonstrated in this PoC.

See the comments in `index.ts` for more details.
