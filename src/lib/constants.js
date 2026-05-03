export const TRAINER_ROLES = ['trainer', 'admin'];

export const isTrainer = (profile) => TRAINER_ROLES.includes(profile?.role);
