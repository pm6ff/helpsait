<?php
class OfferController {
    public function __construct(private OfferModel $model) {}

    public function index(): void {
        $offers = $this->model->getActive();
        require __DIR__ . '/../Views/offers/index.php';
    }
}