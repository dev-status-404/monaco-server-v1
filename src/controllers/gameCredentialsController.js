import { gameCredentialsService } from "../services/gameCredentialsService.js";

const create = async (req, res, next) => {
  try {
    const result = await gameCredentialsService.create(req.body);
    res.status(result.code).json(result);
  } catch (error) { next(error); }
};

const update = async (req, res, next) => {
  try {
    const result = await gameCredentialsService.update(req.params.id, req.body);
    res.status(result.code).json(result);
  } catch (error) { next(error); }
};

const getCredentials = async (req, res, next) => {
  try {
    const result = await gameCredentialsService.getCredentials(req.query);
    res.status(result.code).json(result);
  } catch (error) { next(error); }
};

const assign = async (req, res, next) => {
  try {
    const { game_id, user_id } = req.body;
    const result = await gameCredentialsService.assign(game_id, user_id);
    res.status(result.code).json(result);
  } catch (error) { next(error); }
};

const deleteCredential = async (req, res, next) => {
  try {
    const result = await gameCredentialsService.deleteCredential(req.params.id);
    res.status(result.code).json(result);
  } catch (error) { next(error); }
};

const bulkDelete = async (req, res, next) => {
  try {
    const result = await gameCredentialsService.bulkDelete(req.body.ids);
    res.status(result.code).json(result);
  } catch (error) { next(error); }
};

export const gameCredentialsController = {
  create,
  update,
  getCredentials,
  assign,
  deleteCredential,
  bulkDelete,
};