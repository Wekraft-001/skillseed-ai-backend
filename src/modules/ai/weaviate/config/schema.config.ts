export const bookSchemaConfig = {
  class: 'Book',
  description: 'Educational books for children',
  vectorizer: 'text2vec-openai',
  moduleConfig: {
    'text2vec-openai': {
      model: 'ada',
      modelVersion: '002',
      type: 'text',
    },
  },

  properties: [
    {
      name: 'title',
      dataType: ['text'],
      description: 'Book title',
    },
    {
      name: 'author',
      dataType: ['text'],
      description: 'Book Title',
    },
    {
      name: 'level',
      dataType: ['text'],
      description: 'Reading level: beginner, intermediate, advanced',
    },
    {
      name: 'theme',
      dataType: ['text'],
      description: 'Subject theme (Science, Math, Arts, etc.)',
    },
    {
      name: 'theme',
      dataType: ['text'],
      description: 'Subject theme (Science, Math, Arts, etc.)',
    },
    {
      name: 'description',
      dataType: ['text'],
      description: 'Book description and content summary',
    },
    {
      name: 'keywords',
      dataType: ['text[]'],
      description: 'Relevant keywords and topics',
    },
    {
      name: 'ageGroup',
      dataType: ['text'],
      description: 'Target age group',
    },
    {
      name: 'careerRelevance',
      dataType: ['text[]'],
      description: 'Related career paths',
    },
  ],
};
