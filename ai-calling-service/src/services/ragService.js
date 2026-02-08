// RAG Service - Bedrock Knowledge Base for tenant-isolated document retrieval

import {
  BedrockAgentRuntimeClient,
  RetrieveAndGenerateCommand,
  RetrieveCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';
import { logger } from '../utils/logger.js';

const REGION = process.env.AWS_REGION || 'ap-south-1';
const KNOWLEDGE_BASE_ID = process.env.BEDROCK_KNOWLEDGE_BASE_ID;

const bedrockClient = new BedrockAgentRuntimeClient({ region: REGION });

/**
 * Query knowledge base with strict tenant filtering
 * @param {string} tenantId - Tenant identifier for isolation
 * @param {string} query - User's question
 * @param {string} category - Optional category filter (faq, policies, agency_info)
 * @returns {Promise<{answer: string, sources: Array, confidence: number}>}
 */
export async function queryKnowledgeBase(tenantId, query, category = null) {
  if (!KNOWLEDGE_BASE_ID) {
    logger.warn('Knowledge base ID not configured');
    return {
      answer: null,
      sources: [],
      confidence: 0,
    };
  }
  
  try {
    const startTime = Date.now();
    
    // Build filter for tenant isolation
    const filter = {
      andAll: [
        {
          equals: {
            key: 'tenant_id',
            value: tenantId,
          },
        },
      ],
    };
    
    // Add category filter if specified
    if (category) {
      filter.andAll.push({
        equals: {
          key: 'category',
          value: category,
        },
      });
    }
    
    const command = new RetrieveAndGenerateCommand({
      input: {
        text: query,
      },
      retrieveAndGenerateConfiguration: {
        type: 'KNOWLEDGE_BASE',
        knowledgeBaseConfiguration: {
          knowledgeBaseId: KNOWLEDGE_BASE_ID,
          modelArn: `arn:aws:bedrock:${REGION}::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0`,
          retrievalConfiguration: {
            vectorSearchConfiguration: {
              filter,
              numberOfResults: 5,
            },
          },
          generationConfiguration: {
            promptTemplate: {
              textPromptTemplate: `You are a helpful real estate assistant answering customer questions.
              
Use the following retrieved documents to answer the question. If the documents don't contain relevant information, say so clearly.

Keep your response concise and suitable for a phone conversation (under 100 words).

Retrieved documents:
$search_results$

Question: $query$

Answer:`,
            },
          },
        },
      },
    });
    
    const response = await bedrockClient.send(command);
    
    const latency = Date.now() - startTime;
    logger.metric('RAG_QUERY_LATENCY', latency, 'Milliseconds', { tenantId, category });
    
    // Validate tenant isolation in results
    const validatedSources = (response.citations || []).filter(citation => {
      const metadata = citation.retrievedReferences?.[0]?.metadata || {};
      return metadata.tenant_id === tenantId;
    });
    
    return {
      answer: response.output?.text || null,
      sources: validatedSources.map(c => ({
        content: c.retrievedReferences?.[0]?.content?.text,
        location: c.retrievedReferences?.[0]?.location,
      })),
      confidence: validatedSources.length > 0 ? 0.9 : 0.3,
    };
  } catch (error) {
    logger.error('RAG query failed', error, { tenantId, query });
    return {
      answer: null,
      sources: [],
      confidence: 0,
    };
  }
}

/**
 * Retrieve raw chunks without generation (for hybrid approaches)
 * @param {string} tenantId - Tenant identifier
 * @param {string} query - Search query
 * @param {number} topK - Number of results to return
 * @returns {Promise<Array>}
 */
export async function retrieveChunks(tenantId, query, topK = 5) {
  if (!KNOWLEDGE_BASE_ID) {
    return [];
  }
  
  try {
    const filter = {
      equals: {
        key: 'tenant_id',
        value: tenantId,
      },
    };
    
    const command = new RetrieveCommand({
      knowledgeBaseId: KNOWLEDGE_BASE_ID,
      retrievalQuery: {
        text: query,
      },
      retrievalConfiguration: {
        vectorSearchConfiguration: {
          filter,
          numberOfResults: topK,
        },
      },
    });
    
    const response = await bedrockClient.send(command);
    
    // Double-check tenant isolation
    return (response.retrievalResults || [])
      .filter(result => result.metadata?.tenant_id === tenantId)
      .map(result => ({
        content: result.content?.text,
        score: result.score,
        metadata: result.metadata,
        location: result.location,
      }));
  } catch (error) {
    logger.error('Chunk retrieval failed', error, { tenantId });
    return [];
  }
}

/**
 * Check if tenant has documents in knowledge base
 */
export async function validateTenantAccess(tenantId) {
  try {
    const chunks = await retrieveChunks(tenantId, 'test query', 1);
    return chunks.length > 0;
  } catch {
    return false;
  }
}

export default {
  queryKnowledgeBase,
  retrieveChunks,
  validateTenantAccess,
};
