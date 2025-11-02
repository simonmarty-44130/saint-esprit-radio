import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  // News - Articles et actualités
  News: a
    .model({
      title: a.string().required(),
      content: a.string().required(),
      author: a.string(),
      status: a.enum(['draft', 'published', 'archived']),
      category: a.string(),
      priority: a.integer().default(0),
      duration: a.integer(), // durée en secondes
      audioUrl: a.string(),
      imageUrl: a.string(),
      tags: a.string().array(),
      assignedBlocks: a.string().array(),
      metadata: a.json(),
      publishedAt: a.datetime(), // Date de publication
      expiresAt: a.datetime(), // Date d'expiration
      archivedAt: a.datetime(), // Date d'archivage
      lastModifiedBy: a.string(),
      lastModifiedAt: a.datetime()
    })
    .authorization((allow) => [
      allow.authenticated()
    ]),

  // NewsArchive - Archives des news expirées
  NewsArchive: a
    .model({
      originalId: a.string().required(), // ID de la news originale
      title: a.string().required(),
      content: a.string().required(),
      author: a.string(),
      category: a.string(),
      priority: a.integer(),
      duration: a.integer(),
      audioUrl: a.string(),
      imageUrl: a.string(),
      tags: a.string().array(),
      assignedBlocks: a.string().array(),
      metadata: a.json(),
      publishedAt: a.datetime(),
      expiredAt: a.datetime(),
      archivedAt: a.datetime().required(),
      searchableContent: a.string(), // Contenu indexable pour la recherche
      yearMonth: a.string() // Format YYYY-MM pour partitionnement
    })
    .authorization((allow) => [
      allow.authenticated()
    ]),

  // Animation - Éléments d'animation radio
  Animation: a
    .model({
      title: a.string().required(),
      content: a.string().required(),
      author: a.string(),
      type: a.enum(['jingle', 'pub', 'liner', 'promo', 'music']),
      duration: a.integer(), // durée en secondes
      audioUrl: a.string(),
      category: a.string(),
      tags: a.string().array(),
      metadata: a.json(),
      lastModifiedBy: a.string(),
      lastModifiedAt: a.datetime()
    })
    .authorization((allow) => [
      allow.authenticated()
    ]),

  // Block - Journaux et blocs de contenu
  Block: a
    .model({
      name: a.string().required(),
      type: a.enum(['journal', 'emission', 'playlist', 'custom']),
      content: a.json(), // Structure flexible pour différents types
      items: a.string().array(), // IDs des éléments contenus
      duration: a.integer(), // durée totale en secondes
      scheduledTime: a.datetime(),
      author: a.string(),
      status: a.enum(['draft', 'ready', 'onair', 'archived']),
      metadata: a.json(),
      lastModifiedBy: a.string(),
      lastModifiedAt: a.datetime()
    })
    .authorization((allow) => [
      allow.authenticated()
    ]),

  // Conductor - Conducteur d'antenne
  Conductor: a
    .model({
      date: a.date().required(),
      name: a.string().required(),
      segments: a.json().required(), // Structure complexe des segments
      totalDuration: a.integer(),
      status: a.enum(['draft', 'validated', 'onair', 'archived']),
      author: a.string(),
      validators: a.string().array(),
      metadata: a.json(),
      lastModifiedBy: a.string(),
      lastModifiedAt: a.datetime()
    })
    .authorization((allow) => [
      allow.authenticated()
    ]),

  // Template - Modèles réutilisables
  Template: a
    .model({
      name: a.string().required(),
      type: a.enum(['conductor', 'journal', 'emission', 'playlist']),
      content: a.json().required(),
      category: a.string(),
      tags: a.string().array(),
      isPublic: a.boolean().default(false),
      author: a.string(),
      usageCount: a.integer().default(0),
      metadata: a.json(),
      lastModifiedBy: a.string(),
      lastModifiedAt: a.datetime()
    })
    .authorization((allow) => [
      allow.authenticated()
    ]),

  // Audio - Fichiers audio
  Audio: a
    .model({
      filename: a.string().required(),
      title: a.string(),
      url: a.string().required(),
      s3Key: a.string(),
      duration: a.integer(),
      size: a.integer(),
      format: a.string(),
      category: a.enum(['news', 'animation', 'music', 'podcast', 'other']),
      relatedItemId: a.string(), // ID de l'élément associé
      relatedItemType: a.string(), // Type de l'élément (News, Animation, etc.)
      author: a.string(),
      tags: a.string().array(),
      metadata: a.json(),
      uploadedAt: a.datetime(),
      lastModifiedBy: a.string()
    })
    .authorization((allow) => [
      allow.authenticated()
    ]),

  // UserActivity - Suivi d'activité en temps réel
  UserActivity: a
    .model({
      userId: a.string().required(),
      username: a.string().required(),
      action: a.enum(['online', 'offline', 'editing', 'viewing']),
      itemId: a.string(),
      itemType: a.string(),
      section: a.string(),
      timestamp: a.datetime().required(),
      metadata: a.json()
    })
    .authorization((allow) => [
      allow.authenticated()
    ]),

  // Settings - Paramètres utilisateur/application
  Settings: a
    .model({
      userId: a.string().required(),
      type: a.enum(['user', 'global', 'station']),
      radioName: a.string(),
      radioSlogan: a.string(),
      preferences: a.json(),
      theme: a.enum(['light', 'dark', 'auto']),
      language: a.string().default('fr'),
      notifications: a.boolean().default(true),
      autoSave: a.boolean().default(true),
      autoBackup: a.boolean().default(true),
      metadata: a.json(),
      lastModifiedAt: a.datetime()
    })
    .authorization((allow) => [
      allow.authenticated()
    ]),

  // Emission - Émissions écrites par les bénévoles
  Emission: a
    .model({
      title: a.string().required(),
      content: a.string().required(), // Texte de l'émission
      author: a.string().required(), // Nom du bénévole
      guests: a.string(), // Invités
      musics: a.json(), // Liste des musiques [{title, artist, duration}]
      wordCount: a.integer(), // Nombre de mots
      readingTime: a.integer(), // Temps de lecture en secondes
      musicTime: a.integer(), // Temps total musiques en secondes
      totalTime: a.integer(), // Temps total en secondes
      status: a.enum(['submitted', 'reviewed', 'approved', 'rejected', 'scheduled']),
      submittedAt: a.datetime().required(),
      reviewedAt: a.datetime(),
      reviewedBy: a.string(),
      scheduledAt: a.datetime(),
      reviewNotes: a.string(),
      emailSent: a.boolean().default(false),
      emailSentAt: a.datetime(),
      metadata: a.json()
    })
    .authorization((allow) => [
      allow.authenticated()
    ]),

  // Chronique - Chroniques audio des bénévoles
  Chronique: a
    .model({
      title: a.string().required(),
      author: a.string().required(), // Nom du bénévole
      type: a.enum(['humeur', 'cinema', 'jardinage', 'culture', 'sport', 'cuisine', 'livre', 'musique', 'autre']),
      audioUrl: a.string(), // URL S3 du fichier audio
      s3Key: a.string(), // Clé S3 pour accès direct
      duration: a.integer(), // Durée en secondes
      dateDiffusion: a.date(), // Date de diffusion souhaitée
      lancement: a.string(), // Texte de lancement pour le journaliste
      desannonce: a.string(), // Texte de désannonce
      status: a.enum(['submitted', 'reviewed', 'approved', 'rejected', 'scheduled', 'aired']),
      submittedAt: a.datetime().required(),
      reviewedAt: a.datetime(),
      reviewedBy: a.string(),
      scheduledAt: a.datetime(),
      airedAt: a.datetime(),
      reviewNotes: a.string(),
      emailSent: a.boolean().default(false),
      emailSentAt: a.datetime(),
      metadata: a.json()
    })
    .authorization((allow) => [
      allow.authenticated()
    ])
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool'
  }
});